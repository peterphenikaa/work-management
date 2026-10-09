import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthUser } from './auth.types.js';

const COOKIE = 'access_token';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.auth.register(
      dto.name,
      dto.email,
      dto.password,
      dto.confirmPassword,
    );
    response.cookie(COOKIE, accessToken, cookieOptions);
    return { user };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.auth.login(dto.email, dto.password);
    response.cookie(COOKIE, accessToken, cookieOptions);
    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: { user: AuthUser }) {
    return this.auth.getProfile(request.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() request: { user: AuthUser },
    @Body() dto: UpdateProfileDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, user } = await this.auth.updateProfile(
      request.user.id,
      dto.name,
      dto.phone,
    );
    response.cookie(COOKIE, accessToken, cookieOptions);
    return { user };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() request: { user: AuthUser },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      request.user.id,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
  }
}
