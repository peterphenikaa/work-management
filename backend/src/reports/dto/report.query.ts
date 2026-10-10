import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_PERIODS = ['7d', '30d', 'month', 'quarter'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class ReportQuery {
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period?: ReportPeriod;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(40)
  workspaceId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(40)
  spaceId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(40)
  assigneeId?: string;
}
