import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimToString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class CreateListDto {
  @Transform(({ value }) => trimToString(value))
  @IsString()
  @MinLength(1, { message: 'Tên List không được để trống' })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateListDto extends CreateListDto {
  @IsOptional()
  @IsString()
  spaceId?: string;
}
