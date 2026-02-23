
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSave() {
  const department = "TEST_DEPT";
  const month = 3;
  const year = 2026;
  const userId = 1; // Assuming user 1 exists

  // 1. Create Data (Object Format)
  const dataObject = {
      scheduleData: { "1": { "2026-03-01": "M" } },
      inchargePerDay: {},
      manualTimePerDay: {},
      locationPalette: {}
  };

  try {
      // Clean up first
      await prisma.monthlySchedule.deleteMany({
          where: { department, month, year }
      });

      console.log("Creating Draft...");
      const created = await prisma.monthlySchedule.create({
          data: {
              department,
              month,
              year,
              data: dataObject, // Saving Object
              status: 'DRAFT',
              createdByUserId: userId,
              hodApproved: false
          }
      });
      console.log("Created ID:", created.id);

      // Verify Read
      const read = await prisma.monthlySchedule.findUnique({
          where: { id: created.id }
      });
      console.log("Read Data Type:", typeof read.data);
      console.log("Read Data Is Array?", Array.isArray(read.data));
      console.log("Read Data Content:", JSON.stringify(read.data));

      // 2. Update Data
      const newData = { ...dataObject, updated: true };
      console.log("Updating Draft...");
      await prisma.monthlySchedule.update({
          where: { id: created.id },
          data: {
              data: newData
          }
      });

      // Verify Update
      const updated = await prisma.monthlySchedule.findUnique({
          where: { id: created.id }
      });
      console.log("Updated Data Content:", JSON.stringify(updated.data));

  } catch (e) {
      console.error(e);
  } finally {
      await prisma.$disconnect();
  }
}

testSave();
