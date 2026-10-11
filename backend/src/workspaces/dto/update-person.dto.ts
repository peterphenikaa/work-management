import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'])
  role?: 'ADMIN' | 'MEMBER';

  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
