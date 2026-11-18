import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
// console.log("Prisma booking model:", typeof prisma.booking);

export const connectPostgres = async () => {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL connected successfully');
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
};
