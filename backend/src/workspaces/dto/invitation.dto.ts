import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class InviteMemberDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsIn(['ADMIN', 'LEADER', 'MEMBER'])
  role!: 'ADMIN' | 'LEADER' | 'MEMBER';
}

export class UpdateInvitationDto {
  @IsIn(['ADMIN', 'LEADER', 'MEMBER'])
  role!: 'ADMIN' | 'LEADER' | 'MEMBER';
}
