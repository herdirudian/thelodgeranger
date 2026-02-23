
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const schedules = await prisma.monthlySchedule.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    console.log("=== Latest 5 Monthly Schedules ===");
    schedules.forEach(s => {
      console.log(`ID: ${s.id}`);
      console.log(`Dept: ${s.department}`);
      console.log(`Period: ${s.month}/${s.year}`);
      console.log(`Status: ${s.status}`);
      console.log(`Updated: ${s.updatedAt}`);
      
      let dataContent = s.data;
      if (typeof dataContent === 'string') {
          console.log(`Data Type: STRING (Length: ${dataContent.length})`);
          try {
             dataContent = JSON.parse(dataContent);
             console.log("  (Parsed successfully)");
          } catch(e) {
             console.log("  (Parse failed)");
          }
      } else {
          console.log(`Data Type: OBJECT`);
      }

      if (dataContent) {
          const keys = Object.keys(dataContent);
          console.log(`Data Keys: ${keys.join(', ')}`);
          if (dataContent.scheduleData) {
              const users = Object.keys(dataContent.scheduleData);
              console.log(`  scheduleData Users: ${users.length}`);
              if (users.length > 0) {
                 console.log(`  Sample User ${users[0]}:`, JSON.stringify(dataContent.scheduleData[users[0]]));
              }
          } else if (Array.isArray(dataContent)) {
              console.log(`  Data is Array (Legacy), length: ${dataContent.length}`);
          }
      } else {
          console.log("Data is NULL or Empty");
      }
      console.log("---------------------------------------------------");
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
