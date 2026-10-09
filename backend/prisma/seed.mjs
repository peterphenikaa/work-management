import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const password = await bcrypt.hash('Northstar1', 10);

const users = [
  {
    email: 'admin@northstar.vn',
    name: 'Phạm Quỳnh Anh',
    role: 'ADMIN',
  },
  {
    email: 'leader@northstar.vn',
    name: 'Nguyễn Minh Khoa',
    role: 'LEADER',
  },
  {
    email: 'member@northstar.vn',
    name: 'Lê Thu Hà',
    role: 'MEMBER',
  },
];

for (const user of users) {
  await prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.name, role: user.role, password },
    create: { ...user, password },
  });
  console.log(`seeded ${user.role} ${user.email}`);
}

await prisma.$disconnect();
