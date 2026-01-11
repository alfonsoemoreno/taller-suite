import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
