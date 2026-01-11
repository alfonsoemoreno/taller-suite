import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from './access-token.guard';

const PROTECTED_PREFIXES = [
  '/customers',
  '/vehicles',
  '/work-orders',
  '/payments',
  '/cash-close',
  '/users',
  '/reports',
  '/catalog',
  '/inventory',
  '/suppliers',
  '/purchases',
];

@Injectable()
export class ProtectedRoutesGuard implements CanActivate {
  constructor(private readonly accessTokenGuard: AccessTokenGuard) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path || request.url || '';
    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
      path.startsWith(prefix),
    );
    if (!isProtected) {
      return true;
    }
    return this.accessTokenGuard.canActivate(context);
  }
}
