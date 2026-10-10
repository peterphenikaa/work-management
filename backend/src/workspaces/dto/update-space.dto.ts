import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SPACE_COLORS, SPACE_ICONS, SPACE_VIEWS } from './create-space.dto.js';

function trimToString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class UpdateSpaceStatusDto {
  @IsOptional()
  @IsString()
  id?: string;

  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên trạng thái không được để trống' })
  @MaxLength(40)
  name!: string;
}

export class UpdateSpaceDto {
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên Space không được để trống' })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(SPACE_ICONS)
  icon!: (typeof SPACE_ICONS)[number];

  @IsIn(SPACE_COLORS)
  color!: (typeof SPACE_COLORS)[number];

  @IsIn(['PRIVATE', 'PUBLIC'])
  accessType!: 'PRIVATE' | 'PUBLIC';

  @IsArray()
  @IsString({ each: true })
  memberIds!: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất một trạng thái' })
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => UpdateSpaceStatusDto)
  statuses!: UpdateSpaceStatusDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất một chế độ xem' })
  @IsIn(SPACE_VIEWS, { each: true })
  views!: (typeof SPACE_VIEWS)[number][];
}
