import { IsIn } from 'class-validator';

export class UpdateMemberDto {
  @IsIn(['ADMIN', 'LEADER', 'MEMBER'])
  role!: 'ADMIN' | 'LEADER' | 'MEMBER';
}
