import { Controller, Get, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ReportQuery } from './dto/report.query.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  summary(@Req() request: { user: AuthUser }, @Query() query: ReportQuery) {
    return this.reports.build(request.user, query);
  }

  @Get('export')
  async export(@Req() request: { user: AuthUser }, @Query() query: ReportQuery) {
    const body = await this.reports.exportXlsx(request.user, query);
    const stamp = new Date().toISOString().slice(0, 10);
    return new StreamableFile(body, {
      type: 'application/vnd.ms-excel; charset=utf-8',
      disposition: `attachment; filename="bao-cao-${stamp}.xls"`,
    });
  }
}
