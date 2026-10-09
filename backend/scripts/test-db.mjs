import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRaw`SELECT 1 AS ok, current_database() AS db, current_user AS "user"`;
  const row = rows[0];
  console.log(`OK database=${row.db} user=${row.user}`);
} catch (error) {
  console.error('FAIL', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
