const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const checklistDir = 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist';

const fileToDept = {
    '01.Front Office  Daily Checklist  2026.xlsx': 'FRONT OFFICE',
    '02. Cashier Daily Checklist 2026.xlsx': 'CASHIER',
    '03.Room Checklist The Lodge Camp & Village.xlsx': 'HOUSEKEEPING',
    '04. Parking & Driver Daily Checklist 2026.xlsx': 'PARKING & DRIVER',
    '05. Public Area  Daily Checklist 2026.xlsx': 'PUBLIC AREA',
    '06. IT Checklist 2026.xlsx': 'IT',
    '07. F&B Service Daily Checklist.xlsx': 'F&B SERVICE',
    '08. POMEC Checklist 2026.xlsx': 'POMEC',
    '09. F&B Product Daily Checklist.xlsx': 'F&B PRODUCT',
    '10. Gardener  Daily Checklist 2026.xlsx': 'GARDENER',
    '11. Wahana Daily Checklist.xlsx': 'WAHANA',
    '12. Activity  Daily Checklist  2026.xlsx': 'ACTIVITY'
};

async function seed() {
    const files = fs.readdirSync(checklistDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

    for (const file of files) {
        const dept = fileToDept[file] || file.split('.')[1]?.trim() || file;
        console.log(`Processing ${file} for ${dept}...`);

        try {
            const workbook = XLSX.readFile(path.join(checklistDir, file));
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const template = await prisma.checklistTemplate.create({
                data: {
                    name: file.replace('.xlsx', ''),
                    department: dept,
                }
            });

            let currentCategory = null;
            let catOrder = 1;
            let qOrder = 1;

            for (const row of data) {
                if (!row || row.length === 0) continue;
                const firstCol = String(row[0] || '').trim();
                if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist')) continue;

                // Detect Category (UPPERCASE)
                if (firstCol === firstCol.toUpperCase() && firstCol.length > 3 && !firstCol.includes('TIME')) {
                    currentCategory = await prisma.checklistCategoryTemplate.create({
                        data: {
                            templateId: template.id,
                            name: firstCol,
                            order: catOrder++
                        }
                    });
                    qOrder = 1;
                } else if (currentCategory) {
                    if (firstCol === 'Check list' || firstCol === 'Time Checking') continue;
                    
                    let type = 'BOOLEAN';
                    if (firstCol.includes('____') || firstCol.includes('Number of') || firstCol.includes('Jumlah')) {
                        type = 'NUMBER';
                    }

                    await prisma.checklistQuestionTemplate.create({
                        data: {
                            categoryId: currentCategory.id,
                            question: firstCol,
                            type: type,
                            order: qOrder++
                        }
                    });
                }
            }
            console.log(`Finished ${dept}`);
        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    }
}

seed().then(() => {
    console.log('Seeding complete');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
