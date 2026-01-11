import { headers } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from './lib/prisma';

export type SessionUser = {
  id: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  tenantId: string;
};

type AuthSession = {
  user: SessionUser;
};

const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
const issuer = process.env.NEON_AUTH_ISSUER;

export async function getAuthSession(): Promise<AuthSession | null> {
  const requestHeaders = await headers();
  const authHeader =
    requestHeaders.get('authorization') ?? requestHeaders.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  if (!jwksUrl || !issuer) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jwtVerify(token, jwks, { issuer });

  const email = typeof payload.email === 'string' ? payload.email : null;
  if (!email) {
    return null;
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: typeof payload.name === 'string' ? payload.name : null,
        isActive: true,
        role: 'OWNER',
      },
    });
  }

  if (!user.tenantId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: user.id },
    });
  }

  if (!user.isActive) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? user.id,
    },
  };
}
