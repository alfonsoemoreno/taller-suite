import type { DefaultSession, DefaultUser } from 'next-auth';
import type { UserRole } from '@/shared';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      tenantId: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: UserRole;
    tenantId: string | null;
  }
}
