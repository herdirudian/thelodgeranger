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
            const workbook = XLSX.readFile(filePath);
            
            for (const sheetName of workbook.SheetNames) {
                if (sheetName.startsWith('Sheet') || sheetName.includes('BELUM')) continue;

                const cleanSheetName = sheetName.trim();
                const isDaySheet = days.includes(cleanSheetName);
                
                // Special handling for Room / Housekeeping to create per-unit templates
                if (dept === 'Room / Housekeeping') {
                    const roomUnits = [
                        { name: 'Fun Camp', count: 14 },
                        { name: 'Joglo', count: 2 },
                        { name: 'Villa Kayu', count: 1 },
                        { name: 'Rumah Pohon', count: 2 },
                        { name: 'Rumah Gypsy', count: 1 }
                    ];

                    const worksheet = workbook.Sheets[sheetName];
                    const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    for (const unit of roomUnits) {
                        for (let i = 1; i <= unit.count; i++) {
                            const unitName = unit.count > 1 ? `${unit.name} ${i}` : unit.name;
                            const templateName = `Room - ${unitName}`;
                            
                            // FILTER DATA: Only keep rows where the Category OR Question contains the unitName
                            // or common categories like "GUEST COMPLATIONS"
                            console.log(`  -> Creating room template: ${templateName}`);
                            const template = await prisma.checklistTemplate.create({
                                data: {
                                    name: templateName,
                                    department: dept,
                                    dayOfWeek: null
                                }
                            });

                            let currentCategory = null;
                            let catOrder = 1;
                            let qOrder = 1;
                            let isUnitMatch = false;

                            for (const row of allData) {
                                if (!row || row.length === 0) continue;
                                const firstCol = String(row[0] || '').trim();
                                if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist') || firstCol === '0') continue;

                                const lowerCol = firstCol.toLowerCase();
                                if (lowerCol.includes('signature') || lowerCol.includes('tanda tangan') || lowerCol.includes('disetujui oleh')) continue;

                                // Detect Category (UPPERCASE)
                                if (firstCol === firstCol.toUpperCase() && firstCol.length > 3 && !firstCol.includes('TIME') && !firstCol.includes('CHECK')) {
                                    // If it's a general category or matches our specific unit
                                    // Using more flexible matching for unit names
                                    const categoryUpper = firstCol.toUpperCase();
                                    const unitNameUpper = unit.name.toUpperCase();
                                    
                                    isUnitMatch = categoryUpper.includes(unitNameUpper) || 
                                                  (unit.name === 'Rumah Gypsy' && categoryUpper.includes('GYPSY')) ||
                                                  categoryUpper.includes('GUEST') || 
                                                  categoryUpper.includes('GENERAL') ||
                                                  categoryUpper.includes('KESIMPULAN');
                                    
                                    if (isUnitMatch) {
                                        currentCategory = await prisma.checklistCategoryTemplate.create({
                                            data: {
                                                templateId: template.id,
                                                name: firstCol,
                                                order: catOrder++
                                            }
                                        });
                                        qOrder = 1;
                                    }
                                } else if (currentCategory && isUnitMatch) {
                                    // If we are in a matched category, check if the question is for this specific unit number
                                    // e.g. "Cek Kebersihan Fun Camp 1"
                                    const isSpecificUnitNumber = /\d+/.test(firstCol);
                                    if (isSpecificUnitNumber && !firstCol.includes(String(i))) {
                                        continue; // Skip if it's for a different unit number
                                    }

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
                    }
                    continue; // Skip the default template creation for Room
                }

                // Special handling for Cashier to create per-section templates
                if (dept === 'Cashier') {
                    const cashierSections = [
                        { name: 'Opening - Counter Ticket', keywords: ['OPENING', 'COUNTER TICKET'] },
                        { name: 'Opening - Funicular', keywords: ['OPENING', 'FUNICULAR'] },
                        { name: 'Opening - Omah Bamboo', keywords: ['OPENING', 'OMAH BAMBOO'] },
                        { name: 'Opening - The Pines', keywords: ['OPENING', 'THE PINES'] },
                        { name: 'Opening - The Cave', keywords: ['OPENING', 'THE CAVE'] },
                        { name: 'Closing - Counter Ticket', keywords: ['CLOSING', 'COUNTER TICKET'] },
                        { name: 'Closing - Funicular', keywords: ['CLOSING', 'FUNICULAR'] },
                        { name: 'Closing - Omah Bamboo', keywords: ['CLOSING', 'OMAH BAMBOO'] },
                        { name: 'Closing - The Pines', keywords: ['CLOSING', 'THE PINES'] },
                        { name: 'Closing - The Cave', keywords: ['CLOSING', 'THE CAVE'] },
                        { name: 'Inventory & Stock', keywords: ['INVENTORY', 'STOCK'] },
                        { name: 'General Cashier', keywords: ['GENERAL', 'KESIMPULAN'] }
                    ];

                    const worksheet = workbook.Sheets[sheetName];
                    const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    for (const section of cashierSections) {
                        const templateName = `Cashier - ${section.name}`;
                        console.log(`  -> Creating cashier template: ${templateName}`);
                        
                        const template = await prisma.checklistTemplate.create({
                            data: {
                                name: templateName,
                                department: dept,
                                dayOfWeek: null
                            }
                        });

                        let currentCategory = null;
                        let catOrder = 1;
                        let qOrder = 1;
                        let isSectionMatch = false;

                        for (const row of allData) {
                            if (!row || row.length === 0) continue;
                            const firstCol = String(row[0] || '').trim();
                            if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist') || firstCol === '0') continue;

                            const lowerCol = firstCol.toLowerCase();
                            if (lowerCol.includes('signature') || lowerCol.includes('tanda tangan') || lowerCol.includes('disetujui oleh')) continue;

                            // Detect Category (UPPERCASE)
                            if (firstCol === firstCol.toUpperCase() && firstCol.length > 3 && !firstCol.includes('TIME') && !firstCol.includes('CHECK')) {
                                const categoryUpper = firstCol.toUpperCase();
                                
                                // Check if this category matches ALL keywords in section
                                // e.g. section "Opening - Funicular" keywords are ["OPENING", "FUNICULAR"]
                                isSectionMatch = section.keywords.every(k => categoryUpper.includes(k)) || 
                                                 categoryUpper.includes('GENERAL') || 
                                                 categoryUpper.includes('KESIMPULAN');
                                
                                if (isSectionMatch) {
                                    currentCategory = await prisma.checklistCategoryTemplate.create({
                                        data: {
                                            templateId: template.id,
                                            name: firstCol,
                                            order: catOrder++
                                        }
                                    });
                                    qOrder = 1;
                                }
                            } else if (currentCategory && isSectionMatch) {
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
                    continue;
                }
                
                const templateName = isDaySheet 
                    ? `${dept} (${cleanSheetName})` 
                    : (workbook.SheetNames.length > 1 ? `${dept} - ${cleanSheetName}` : dept);

                console.log(`  -> Creating template: ${templateName}`);

                const template = await prisma.checklistTemplate.create({
                    data: {
                        name: templateName,
                        department: dept,
                        dayOfWeek: isDaySheet ? cleanSheetName : null
                    }
                });

                await createQuestionsForTemplate(template, workbook.Sheets[sheetName]);
            }
            console.log(`Finished ${dept}`);
        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    }
}

async function createQuestionsForTemplate(template, worksheet) {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
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

seed().then(() => {
    console.log('Seeding complete');
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
