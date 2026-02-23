const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding special department approval flows...');

  // Configure specific departments
  // Merchandise & Photographer:
  // Request: HOD -> HR -> GM (Skip Supervisor)
  // Procurement: HOD -> FINANCE -> GM (Skip Supervisor)

  const departments = ['Merchandise', 'Photographer'];

  for (const dept of departments) {
    console.log(`Configuring ${dept}...`);

    // Delete existing configs for this department to ensure clean state
    await prisma.approvalConfig.deleteMany({
        where: { department: dept }
    });

    // 1. Create Request Config
    // Standard: HOD -> SPV -> HR -> GM
    // Custom: HOD -> HR -> GM
    const reqConfig = await prisma.approvalConfig.create({
        data: {
            module: 'REQUEST',
            department: dept,
            enabled: true,
            steps: {
                create: [
                    { order: 1, role: 'HOD' },
                    { order: 2, role: 'HR' },
                    { order: 3, role: 'GM' }
                ]
            }
        }
    });
    console.log(`Created REQUEST config for ${dept}`);

    // 2. Create Procurement Config
    // Standard: HOD -> SPV -> FINANCE -> GM
    // Custom: HOD -> FINANCE -> GM
    const procConfig = await prisma.approvalConfig.create({
        data: {
            module: 'PROCUREMENT',
            department: dept,
            enabled: true,
            steps: {
                create: [
                    { order: 1, role: 'HOD' },
                    { order: 2, role: 'FINANCE' },
                    { order: 3, role: 'GM' }
                ]
            }
        }
    });
    console.log(`Created PROCUREMENT config for ${dept}`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
