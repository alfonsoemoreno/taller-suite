import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types';
import type { AuthUser } from '@taller/shared';

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL = '30d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private get accessSecret() {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get refreshSecret() {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private get accessTtl(): JwtSignOptions['expiresIn'] {
    return (
      this.configService.get<string>('JWT_ACCESS_TTL') ?? DEFAULT_ACCESS_TTL
    ) as JwtSignOptions['expiresIn'];
  }

  private get refreshTtl(): JwtSignOptions['expiresIn'] {
    return (
      this.configService.get<string>('JWT_REFRESH_TTL') ?? DEFAULT_REFRESH_TTL
    ) as JwtSignOptions['expiresIn'];
  }

  private get saltRounds() {
    const raw = this.configService.get<string>('BCRYPT_SALT_ROUNDS');
    return raw ? Number(raw) : 10;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Usuario desactivado');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: AuthUser['role'];
    tenantId: string;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
  }

  private async signAccessToken(payload: AccessTokenPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
  }

  private async issueRefreshToken(userId: string) {
    const tokenId = randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, rid: tokenId };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl,
    });
    const tokenHash = await bcrypt.hash(token, this.saltRounds);
    const expiresAt = this.getRefreshExpiryDate();

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  private getRefreshExpiryDate() {
    const raw = this.refreshTtl;
    if (typeof raw === 'number') {
      return new Date(Date.now() + raw * 1000);
    }
    const ttl = raw ?? DEFAULT_REFRESH_TTL;
    const ttlString = typeof ttl === 'string' ? ttl : String(ttl);
    if (ttlString.endsWith('d')) {
      const days = Number(ttlString.slice(0, -1));
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    if (ttlString.endsWith('h')) {
      const hours = Number(ttlString.slice(0, -1));
      return new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    if (ttlString.endsWith('m')) {
      const minutes = Number(ttlString.slice(0, -1));
      return new Date(Date.now() + minutes * 60 * 1000);
    }
    const seconds = Number(ttlString);
    if (!Number.isNaN(seconds)) {
      return new Date(Date.now() + seconds * 1000);
    }
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const accessToken = await this.signAccessToken({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
    });
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.rid },
    });

    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token not found');
    }
    if (stored.revokedAt) {
      throw new ForbiddenException('Refresh token revoked');
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = await this.signAccessToken({
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
    });
    const newRefreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: this.toAuthUser(user),
    };
  }

  async logout(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.refreshSecret },
      );
    } catch {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { id: payload.rid, userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
