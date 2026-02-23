const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Prisma keys:', Object.keys(prisma));
  // Also try lowercase/uppercase variations just in case
  console.log('approvalConfig:', !!prisma.approvalConfig);
  console.log('ApprovalConfig:', !!prisma.ApprovalConfig);
}

main().finally(() => prisma.$disconnect());
