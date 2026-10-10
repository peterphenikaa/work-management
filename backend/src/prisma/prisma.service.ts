import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.port === '6543') {
      url.searchParams.set('pgbouncer', 'true');
      if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = databaseUrl();
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (error) {
      this.logger.warn(
        `Database connection failed — check DATABASE_URL in .env. ${String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
