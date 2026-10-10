import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TASK_PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

function trimToString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull(value: unknown) {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export class CreateTaskDto {
  @IsString()
  listId!: string;

  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên công việc không được để trống' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  reporterId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  dueAt?: string | null;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  listId?: string;

  @IsOptional()
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên công việc không được để trống' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  reporterId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  dueAt?: string | null;
}
