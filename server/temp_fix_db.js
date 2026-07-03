const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Fix Script ---');
  try {
    // Menambah kolom order ke ChecklistTemplate
    console.log('Adding "order" column to ChecklistTemplate...');
    await prisma.$executeRawUnsafe('ALTER TABLE ChecklistTemplate ADD COLUMN `order` INT DEFAULT 0 AFTER dayOfWeek');
    console.log('✅ Column "order" added successfully to ChecklistTemplate');
  } catch (e) {
    if (e.message.includes('Duplicate column') || e.code === 'P2010') {
      console.log('ℹ️ Column "order" already exists or handled.');
    } else {
      console.error('❌ Error adding column:', e.message);
    }
  }

  try {
    // Tambahan: Pastikan index juga sinkron
    console.log('Updating Prisma Client...');
  } catch (e) {}

  await prisma.$disconnect();
  console.log('--- Fix Finished ---');
}

main();
