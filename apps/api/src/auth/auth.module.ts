import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './guards/access-token.guard';
import { ProtectedRoutesGuard } from './guards/protected-routes.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenGuard,
    ProtectedRoutesGuard,
    {
      provide: APP_GUARD,
      useClass: ProtectedRoutesGuard,
    },
  ],
})
export class AuthModule {}
