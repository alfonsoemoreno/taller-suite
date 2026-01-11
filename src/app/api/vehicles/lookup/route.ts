import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VehicleLookupRequestSchema, normalizePlate } from '@/shared';
import type { Prisma } from '@prisma/client';

const CACHE_TTL_DAYS = 30;

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = VehicleLookupRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const normalizedPlate = normalizePlate(parsed.data.plate);
  if (!normalizedPlate) {
    return NextResponse.json({ message: 'Patente invalida.' }, { status: 400 });
  }

  const cached = await prisma.vehicleLookupCache.findUnique({
    where: { plate: normalizedPlate },
  });

  if (cached && isCacheValid(cached.fetchedAt)) {
    const cachedResponse = cached.responseJson as Record<string, unknown>;
    const rebuilt = rebuildFromCacheIfNeeded(normalizedPlate, cachedResponse);
    if (rebuilt) {
      await prisma.vehicleLookupCache.update({
        where: { plate: normalizedPlate },
        data: {
          responseJson: rebuilt,
          fetchedAt: new Date(),
        },
      });
      return NextResponse.json(rebuilt);
    }
    return NextResponse.json(cachedResponse);
  }

  const apiKey = process.env.GETAPI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: 'GETAPI_KEY no configurada.' },
      { status: 400 },
    );
  }

  const response = await fetch(
    `https://chile.getapi.cl/v1/vehicles/plate/${normalizedPlate}`,
    {
      headers: {
        'x-api-key': apiKey,
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { message: 'Error consultando GetAPI.' },
      { status: 502 },
    );
  }

  const rawData: unknown = await response.json();
  if (!rawData || typeof rawData !== 'object') {
    return NextResponse.json(
      { message: 'Respuesta inválida de GetAPI.' },
      { status: 502 },
    );
  }

  const normalizedResponse = normalizeResponse(
    normalizedPlate,
    rawData as Record<string, unknown>,
  );

  await prisma.vehicleLookupCache.upsert({
    where: { plate: normalizedPlate },
    create: {
      plate: normalizedPlate,
      responseJson: normalizedResponse,
    },
    update: {
      responseJson: normalizedResponse,
      fetchedAt: new Date(),
    },
  });

  return NextResponse.json(normalizedResponse);
}

function isCacheValid(fetchedAt: Date) {
  const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return fetchedAt.getTime() >= Date.now() - ttlMs;
}

function rebuildFromCacheIfNeeded(
  plate: string,
  cached: Record<string, unknown>,
): Prisma.InputJsonObject | null {
  const hasMainFields =
    cached.brand ||
    cached.model ||
    cached.year ||
    cached.fuel ||
    cached.transmission ||
    cached.typeVehicle ||
    cached.doors ||
    cached.version ||
    cached.mileage ||
    cached.vin ||
    cached.engineNo ||
    cached.color;
  if (hasMainFields) {
    return null;
  }
  const raw = cached.raw;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return normalizeResponse(plate, raw as Record<string, unknown>);
}

function normalizeResponse(
  plate: string,
  data: Record<string, unknown>,
): Prisma.InputJsonObject {
  const getNested = (path: string[]) => {
    let current: unknown = data;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  };

  const pick = (paths: string[][]) => {
    for (const path of paths) {
      const value = getNested(path);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return undefined;
  };

  const yearValue = pick([
    ['year'],
    ['data', 'year'],
    ['data', 'model', 'year'],
    ['anio'],
    ['ano'],
    ['year_model'],
  ]);
  const year = typeof yearValue === 'string' ? Number(yearValue) : yearValue;
  const doorsValue = pick([['doors'], ['data', 'doors']]);
  const doors = typeof doorsValue === 'string' ? Number(doorsValue) : doorsValue;
  const mileageValue = pick([['mileage'], ['data', 'mileage']]);
  const mileage =
    typeof mileageValue === 'string' ? Number(mileageValue) : mileageValue;
  const safeRaw = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;

  return {
    plate,
    brand:
      pick([
        ['brand'],
        ['marca'],
        ['make'],
        ['data', 'model', 'brand', 'name'],
      ]) ?? null,
    model:
      pick([
        ['model'],
        ['modelo'],
        ['data', 'model', 'name'],
        ['data', 'version'],
      ]) ?? null,
    year: typeof year === 'number' && !Number.isNaN(year) ? year : null,
    fuel: pick([['fuel'], ['data', 'fuel']]) ?? null,
    transmission: pick([['transmission'], ['data', 'transmission']]) ?? null,
    typeVehicle:
      pick([['typeVehicle'], ['data', 'model', 'typeVehicle', 'name']]) ?? null,
    doors: typeof doors === 'number' && !Number.isNaN(doors) ? doors : null,
    version: pick([['version'], ['data', 'version']]) ?? null,
    mileage: typeof mileage === 'number' && !Number.isNaN(mileage) ? mileage : null,
    vin:
      pick([['vin'], ['vin_number'], ['nro_vin'], ['data', 'vinNumber']]) ?? null,
    engineNo:
      pick([
        ['engineNo'],
        ['engine_number'],
        ['numero_motor'],
        ['motor'],
        ['data', 'engineNumber'],
      ]) ?? null,
    color: pick([['color'], ['colour'], ['color_name'], ['data', 'color']]) ?? null,
    raw: safeRaw,
  };
}
