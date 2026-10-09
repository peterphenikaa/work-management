import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

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

      const { id, email, name, role } = payload as AuthUser;
      if (!id || !email || !name || !role) {
        throw new UnauthorizedException();
      }

      return { id, email, name, role };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
  }

  private toProfile(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  private secret() {
    return this.config.get<string>('JWT_SECRET', 'northstar-local-jwt-secret');
  }
}
