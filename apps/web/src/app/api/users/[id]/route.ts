import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserUpdateSchema } from '@taller/shared';

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }

  const guard = ensureTenant(session.user);
  if (guard) {
    return guard;
  }

  const payload = await request.json();
  const parsed = UserUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!target) {
    return NextResponse.json({ message: 'Usuario no encontrado.' }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      role: parsed.data.role ?? target.role,
      isActive: parsed.data.isActive ?? target.isActive,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}
