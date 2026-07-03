const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- 🚀 EMERGENCY DATABASE FIX V3 🚀 ---');
  
  try {
    // 1. Cek koneksi & Database name
    const dbName = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
    console.log(`Connected to Database: ${dbName[0].db}`);

    // 2. Cek semua tabel yang ada
    const tables = await prisma.$queryRawUnsafe('SHOW TABLES');
    console.log('Tables found in DB:', JSON.stringify(tables));

    const tablesToTry = ['ChecklistTemplate', 'checklisttemplate', 'Checklist_Template'];
    
    let success = false;
    for (const tableName of tablesToTry) {
      try {
        console.log(`Checking table: ${tableName}...`);
        
        // Cek apakah kolom order sudah ada
        const columns = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM ${tableName} LIKE 'order'`);
        
        if (columns.length > 0) {
          console.log(`ℹ️ Column "order" already exists in ${tableName}.`);
          success = true;
          continue;
        }

        console.log(`Adding "order" column to ${tableName}...`);
        await prisma.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN \`order\` INT DEFAULT 0 AFTER dayOfWeek`);
        console.log(`✅ SUCCESS: Column "order" added to ${tableName}`);
        success = true;
      } catch (e) {
        if (e.message.includes("doesn't exist")) {
          console.log(`❌ Table ${tableName} skipped (not found).`);
        } else {
          console.error(`❌ Error on ${tableName}:`, e.message);
        }
      }
    }

    if (!success) {
      console.error('⚠️ PERINGATAN: Tidak ada tabel template yang berhasil diupdate. Pastikan nama tabel benar.');
    }

  } catch (globalError) {
    console.error('🛑 CRITICAL ERROR:', globalError.message);
  }

  await prisma.$disconnect();
  console.log('--- 🏁 Fix Finished 🏁 ---');
}

main();
