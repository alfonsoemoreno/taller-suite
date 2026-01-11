import { createRequire } from 'node:module';

process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');

const globalForPrisma = global as typeof global & { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
