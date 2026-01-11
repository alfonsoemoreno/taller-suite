import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getAuthSession } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserCreateSchema } from '@/shared';

function ensureTenant(sessionUser: { tenantId: string | null; role: string }) {
  if (!sessionUser.tenantId) {
    return NextResponse.json(
      { message: 'Tenant no configurado.' },
      { status: 400 },
    );
  }
  if (sessionUser.role === 'STAFF') {
    return NextResponse.json({ message: 'Sin permisos.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }

  const guard = ensureTenant(session.user);
  if (guard) {
    return guard;
  }

  const users = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }

  const guard = ensureTenant(session.user);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = UserCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return NextResponse.json({ message: 'Email ya registrado.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      tenantId: session.user.tenantId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
