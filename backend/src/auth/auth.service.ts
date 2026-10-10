import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser, Role } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async register(name: string, email: string, password: string, confirmPassword: string) {
    if (password !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const user = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        role: 'MEMBER',
      },
    });

    return this.issue(user);
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return this.toProfile(user);
  }

  async updateProfile(id: string, name: string, phone?: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone?.trim() ? phone.trim() : null,
      },
    });
    return this.issue(user);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });

    return { ok: true };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (user.locked) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    return this.issue(user);
  }

  private issue(user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: Role;
  }) {
    const profile = this.toProfile(user);
    const accessToken = jwt.sign(profile, this.secret(), { expiresIn: '7d' });
    return { accessToken, user: profile };
  }

  verify(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.secret());
      if (!payload || typeof payload === 'string') {
        throw new UnauthorizedException();
      }

      const { id, email, name, role, phone } = payload as AuthUser;
      if (!id || !email || !name || !role) {
        throw new UnauthorizedException();
      }

      return { id, email, name, role, phone: phone ?? null };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
  }

  private toProfile(user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: Role;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
  }

  private secret() {
    return this.config.get<string>('JWT_SECRET', 'northstar-local-jwt-secret');
  }
}
