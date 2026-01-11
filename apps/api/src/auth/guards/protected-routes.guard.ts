import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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
    const request = context.switchToHttp().getRequest();
    const path = request?.url ?? request?.path ?? '';
    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
      path.startsWith(prefix),
    );
    if (!isProtected) {
      return true;
    }
    return this.accessTokenGuard.canActivate(context);
  }
}
