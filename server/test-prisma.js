const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  if (prisma.learningModule) {
    console.log('prisma.learningModule exists');
    try {
      const count = await prisma.learningModule.count();
      console.log('Count:', count);
    } catch (e) {
      console.error('Error querying:', e.message);
    }
  } else {
    console.error('prisma.learningModule is UNDEFINED');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
