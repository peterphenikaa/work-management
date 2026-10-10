import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsIn(['ADMIN', 'LEADER', 'MEMBER'])
  role?: 'ADMIN' | 'LEADER' | 'MEMBER';

  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
