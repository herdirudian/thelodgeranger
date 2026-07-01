const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const checklistDir = process.platform === 'win32' 
    ? 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist\\Checklist Fix' 
    : '/var/www/thelodgeranger/Checklist';

const fileToDept = {
    '02. Cashier Daily Checklist 2026.xlsx': 'Cashier',
    '03.Room Checklist The Lodge Camp & Village.xlsx': 'Room / Housekeeping',
    '04. Parking & Driver Daily Checklist 2026.xlsx': 'Parkir'
};

async function seed() {
    const files = Object.keys(fileToDept);
    console.log(`Starting seed for 3 specific departments: ${files.join(', ')}`);

    // Clear existing templates to avoid duplicates during re-seed
    await prisma.checklistAnswer.deleteMany();
    await prisma.checklistSubmission.deleteMany();
    await prisma.checklistQuestionTemplate.deleteMany();
    await prisma.checklistCategoryTemplate.deleteMany();
    await prisma.checklistTemplate.deleteMany();

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    for (const file of files) {
        const filePath = path.join(checklistDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}, skipping...`);
            continue;
        }

        const dept = fileToDept[file];
        console.log(`Processing ${file} for ${dept}...`);

        try {
            const workbook = XLSX.readFile(path.join(checklistDir, file));
            
            for (const sheetName of workbook.SheetNames) {
                if (sheetName.startsWith('Sheet') || sheetName.includes('BELUM')) continue;

                const cleanSheetName = sheetName.trim();
                const isDaySheet = days.includes(cleanSheetName);
                
                const templateName = isDaySheet 
                    ? `${dept} (${cleanSheetName})` 
                    : (workbook.SheetNames.length > 1 ? `${dept} - ${cleanSheetName}` : dept);

                console.log(`  -> Creating template: ${templateName}`);

                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const template = await prisma.checklistTemplate.create({
                    data: {
                        name: templateName,
                        department: dept,
                        dayOfWeek: isDaySheet ? cleanSheetName : null
                    }
                });

                let currentCategory = null;
                let catOrder = 1;
                let qOrder = 1;

                for (const row of data) {
                    if (!row || row.length === 0) continue;
                    const firstCol = String(row[0] || '').trim();
                    if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist') || firstCol === '0') continue;

                    // Skip rows that are actually meant for signatures
                    const lowerCol = firstCol.toLowerCase();
                    if (lowerCol.includes('signature') || lowerCol.includes('tanda tangan') || lowerCol.includes('disetujui oleh')) continue;

                    // Detect Category (UPPERCASE)
                    if (firstCol === firstCol.toUpperCase() && firstCol.length > 3 && !firstCol.includes('TIME') && !firstCol.includes('CHECK')) {
                        currentCategory = await prisma.checklistCategoryTemplate.create({
                            data: {
                                templateId: template.id,
                                name: firstCol,
                                order: catOrder++
                            }
                        });
                        qOrder = 1;
                    } else if (currentCategory) {
                        if (firstCol === 'Check list' || firstCol === 'Time Checking' || firstCol === 'YES' || firstCol === 'NO') continue;
                        
                        let type = 'BOOLEAN';
                        if (firstCol.includes('____') || firstCol.includes('Number of') || firstCol.includes('Jumlah') || firstCol.includes('Time')) {
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
