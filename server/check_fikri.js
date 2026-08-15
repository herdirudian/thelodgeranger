const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'Fikri Mausul' } },
    include: { assignedChecklists: true }
  });
  console.log('User Fikri Mausul:', JSON.stringify(user, null, 2));

  const templates = await prisma.checklistTemplate.findMany({
    select: { id: true, name: true, department: true }
  });
  console.log('Available Templates:', templates);
}

main().catch(console.error).finally(() => prisma.$disconnect());
