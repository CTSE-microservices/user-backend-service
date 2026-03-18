// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed roles
  await prisma.userRole.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      roleName: 'ADMIN',
      description: 'Administrator',
    },
  });

  await prisma.userRole.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      roleName: 'CUSTOMER',
      description: 'Customer',
    },
  });

  await prisma.userRole.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      roleName: 'VENDOR',
      description: 'Vendor',
    },
  });

  // Seed channels
  await prisma.userChannel.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      channelName: 'RETAIL',
      description: 'Retail channel',
    },
  });

  await prisma.userChannel.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      channelName: 'WHOLESALE',
      description: 'Wholesale channel',
    },
  });

  console.log('Seeded user_roles and user_channels');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });