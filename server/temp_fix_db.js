const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Fix Script ---');
  const tablesToTry = ['ChecklistTemplate', 'checklisttemplate', 'Checklist_Template'];
  
  let success = false;
  for (const tableName of tablesToTry) {
    try {
      console.log(`Trying to add "order" column to table: ${tableName}...`);
      await prisma.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN \`order\` INT DEFAULT 0 AFTER dayOfWeek`);
      console.log(`✅ Success! Column "order" added to ${tableName}`);
      success = true;
      break; 
    } catch (e) {
      if (e.message.includes('Duplicate column') || e.code === 'P2010') {
        console.log(`ℹ️ Column "order" already exists in ${tableName}.`);
        success = true;
        break;
      } else if (e.message.includes("doesn't exist")) {
        console.log(`❌ Table ${tableName} does not exist, trying next...`);
      } else {
        console.error(`❌ Error on ${tableName}:`, e.message);
      }
    }
  }

  if (!success) {
    console.error('⚠️ Could not find the correct table name to update. Please check your database table names.');
  }

  await prisma.$disconnect();
  console.log('--- Fix Finished ---');
}

main();
