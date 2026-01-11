import type { UserRole } from '@taller/shared';

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  tenantId: string;
};

export type RefreshTokenPayload = {
  sub: string;
  rid: string;
};
