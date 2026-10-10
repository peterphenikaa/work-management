import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

function trimToString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull(value: unknown) {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export class WorkspaceMemberDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsIn(['ADMIN', 'LEADER', 'MEMBER'])
  role!: 'ADMIN' | 'LEADER' | 'MEMBER';
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên workspace không được để trống' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(4)
  icon?: string | null;

  @IsOptional()
  @IsIn(['PRIVATE', 'PUBLIC'])
  accessType?: 'PRIVATE' | 'PUBLIC';

  @IsOptional()
  @IsString()
  @MinLength(1)
  ownerId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceMemberDto)
  members?: WorkspaceMemberDto[];

  @IsISO8601()
  updatedAt!: string;
}
