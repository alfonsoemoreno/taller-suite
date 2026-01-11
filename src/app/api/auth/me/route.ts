import { NextResponse } from 'next/server';
import { getAuthSession } from '@/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
  }
  const user = session.user;

  return NextResponse.json({ user: user });
}
