const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    console.log("Connecting to DB...");
    const count = await prisma.user.count();
    console.log(`Database connected successfully. User count: ${count}`);
  } catch (e) {
    console.error("DB Connection failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
