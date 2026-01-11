import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserCreate, UserResetPassword, UserUpdate } from '@taller/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload) {
    this.ensureAdmin(user);
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AccessTokenPayload, data: UserCreate) {
    this.ensureAdmin(user);
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('Email ya registrado');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        tenantId: user.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(user: AccessTokenPayload, id: string, data: UserUpdate) {
    this.ensureAdmin(user);
    const target = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.prisma.user.update({
      where: { id: target.id },
      data: {
        role: data.role ?? target.role,
        isActive: data.isActive ?? target.isActive,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async resetPassword(
    user: AccessTokenPayload,
    id: string,
    data: UserResetPassword,
  ) {
    this.ensureAdmin(user);
    const target = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    await this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  private ensureAdmin(user: AccessTokenPayload) {
    if (user.role === 'STAFF') {
      throw new ForbiddenException('Sin permisos');
    }
  }
}
