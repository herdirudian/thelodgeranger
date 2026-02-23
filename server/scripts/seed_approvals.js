const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding approval configurations for Merchandise and Photographer (New Roles)...');

  const configs = [
    // Merchandise - REQUEST: Staff -> HOD Merchandise -> SPV Merchandise
    {
      module: 'REQUEST',
      department: 'Merchandise',
      steps: [
        { role: 'MERCHANDISE_HOD', order: 1, approverDepartment: 'Merchandise' },
        { role: 'MERCHANDISE_SPV', order: 2, approverDepartment: 'Merchandise' }
      ]
    },
    // Merchandise - PROCUREMENT: Staff -> HOD Merchandise -> SPV Merchandise
    {
      module: 'PROCUREMENT',
      department: 'Merchandise',
      steps: [
        { role: 'MERCHANDISE_HOD', order: 1, approverDepartment: 'Merchandise' },
        { role: 'MERCHANDISE_SPV', order: 2, approverDepartment: 'Merchandise' }
      ]
    },
    // Photographer - REQUEST: Staff -> HOD Photographer -> HOD Merchandise -> SPV Merchandise
    {
      module: 'REQUEST',
      department: 'Photographer',
      steps: [
        { role: 'PHOTOGRAPHER_HOD', order: 1, approverDepartment: 'Photographer' },
        { role: 'MERCHANDISE_HOD', order: 2, approverDepartment: 'Merchandise' },
        { role: 'MERCHANDISE_SPV', order: 3, approverDepartment: 'Merchandise' }
      ]
    },
    // Photographer - PROCUREMENT: Staff -> HOD Photographer -> HOD Merchandise -> SPV Merchandise
    {
      module: 'PROCUREMENT',
      department: 'Photographer',
      steps: [
        { role: 'PHOTOGRAPHER_HOD', order: 1, approverDepartment: 'Photographer' },
        { role: 'MERCHANDISE_HOD', order: 2, approverDepartment: 'Merchandise' },
        { role: 'MERCHANDISE_SPV', order: 3, approverDepartment: 'Merchandise' }
      ]
    }
  ];

  for (const config of configs) {
    console.log(`Processing ${config.department} - ${config.module}...`);

    // Check if config exists
    const existingConfig = await prisma.approvalConfig.findFirst({
      where: {
        module: config.module,
        department: config.department
      }
    });

    let configId;

    if (existingConfig) {
      console.log(`  Config exists (ID: ${existingConfig.id}). Updating steps...`);
      configId = existingConfig.id;
      
      // Delete existing steps
      await prisma.approvalStep.deleteMany({
        where: { approvalConfigId: configId }
      });
    } else {
      console.log(`  Creating new config...`);
      const newConfig = await prisma.approvalConfig.create({
        data: {
          module: config.module,
          department: config.department,
          enabled: true
        }
      });
      configId = newConfig.id;
    }

    // Create steps
    for (const step of config.steps) {
      await prisma.approvalStep.create({
        data: {
          approvalConfigId: configId,
          role: step.role,
          order: step.order,
          approverDepartment: step.approverDepartment
        }
      });
    }
    console.log(`  Steps created: ${config.steps.map(s => `${s.role}(${s.approverDepartment})`).join(' -> ')}`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
