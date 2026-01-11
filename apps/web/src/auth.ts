import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import OIDC from 'next-auth/providers/oidc';
import { prisma } from './lib/prisma';

export const { handlers, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    OIDC({
      id: 'neon',
      name: 'Neon',
      issuer: process.env.NEON_AUTH_ISSUER,
      clientId: process.env.NEON_AUTH_CLIENT_ID,
      clientSecret: process.env.NEON_AUTH_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'database',
  },
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.tenantId = user.tenantId ?? null;
      }
      return session;
    },
  },
  events: {
    createUser: async ({ user }) => {
      if (!user.tenantId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { tenantId: user.id },
        });
      }
    },
    signIn: async ({ user }) => {
      if (!user.tenantId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { tenantId: user.id },
        });
      }
    },
  },
});
