import { Transform, Type } from 'class-transformer';
import { InviteMemberDto } from './invitation.dto.js';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

function trimToString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class InitialMemberDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsIn(['ADMIN', 'LEADER', 'MEMBER'])
  role!: 'ADMIN' | 'LEADER' | 'MEMBER';
}

export class CreateWorkspaceDto {
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên workspace không được để trống' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(4)
  icon?: string;

  @IsString()
  @MinLength(1)
  ownerId!: string;

  @IsIn(['PRIVATE', 'PUBLIC'])
  accessType!: 'PRIVATE' | 'PUBLIC';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialMemberDto)
  initialMembers?: InitialMemberDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteMemberDto)
  invites?: InviteMemberDto[];
}
