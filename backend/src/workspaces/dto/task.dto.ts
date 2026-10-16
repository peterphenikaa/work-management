import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number | null;
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

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  sprintId?: string | null;
}

export class BulkUpdateTasksDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  taskIds!: string[];

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  sprintId?: string | null;
}

export class UpdateSpaceSettingsDto {
  @IsBoolean()
  memberCanCreateTask!: boolean;
}

export class CreateCommentDto {
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Bình luận không được để trống' })
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  mentionIds?: string[];
}

export class CreateCheckDto {
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Mục checklist không được để trống' })
  @MaxLength(200)
  title!: string;
}

export class UpdateCheckDto {
  @IsOptional()
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class CreateSprintDto {
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên Sprint không được để trống' })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(500)
  goal?: string | null;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}
