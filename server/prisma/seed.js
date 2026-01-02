const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  // GM
  await prisma.user.upsert({
    where: { email: 'gm@lodge.com' },
    update: {},
    create: {
      email: 'gm@lodge.com',
      name: 'General Manager',
      password,
      role: 'GM',
      department: 'Management',
    },
  });

  // HR
  await prisma.user.upsert({
    where: { email: 'hr@lodge.com' },
    update: {},
    create: {
      email: 'hr@lodge.com',
      name: 'HR Manager',
      password,
      role: 'HR',
      department: 'Human Resources',
    },
  });

  // HOD Housekeeping
  await prisma.user.upsert({
    where: { email: 'hod@lodge.com' },
    update: {},
    create: {
      email: 'hod@lodge.com',
      name: 'Head of Housekeeping',
      password,
      role: 'HOD',
      department: 'Housekeeping',
    },
  });

  // Staff Housekeeping
  await prisma.user.upsert({
    where: { email: 'staff@lodge.com' },
    update: {},
    create: {
      email: 'staff@lodge.com',
      name: 'Staff Member',
      password,
      role: 'STAFF',
      department: 'Housekeeping',
    },
  });

  // HOD Cashier
  await prisma.user.upsert({
    where: { email: 'hod.cashier@lodge.com' },
    update: {},
    create: {
      email: 'hod.cashier@lodge.com',
      name: 'Head Cashier',
      password,
      role: 'HOD',
      department: 'Cashier',
    },
  });

  // Staff Cashier
  await prisma.user.upsert({
    where: { email: 'staff.cashier@lodge.com' },
    update: {},
    create: {
      email: 'staff.cashier@lodge.com',
      name: 'Cashier Staff',
      password,
      role: 'STAFF',
      department: 'Cashier',
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
