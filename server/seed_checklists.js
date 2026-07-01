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
                                    const isSpecificUnitNumber = /\d+/.test(firstCol);
                                    if (isSpecificUnitNumber && !firstCol.includes(String(i))) {
                                        continue;
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
                    continue;
                }

                // Special handling for Parking to create per-area and per-vehicle templates
                if (dept === 'Parkir') {
                    const worksheet = workbook.Sheets[sheetName];
                    const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    const parkingSections = [
                        'AREA PARKIR UMUM', 
                        'AREA PARKIR CIKEBUL', 
                        'AREA PARKIR FAIRY GARDEN (FG)',
                        'CHECKLIST KENDARAAN OPERASIONAL',
                        'CLOSING CHECKLIST',
                        'KENDARAAN OPERASIONAL'
                    ];

                    const templateMap = {};
                    // We'll create templates dynamically as we find them in the sheet
                    
                    let currentTemplate = null;
                    let currentCategory = null;
                    let qOrder = 1;
                    let vehicleCount = 0;

                    for (const row of allData) {
                        if (!row || row.length === 0) continue;
                        const firstCol = String(row[0] || '').trim();
                        const upper = firstCol.toUpperCase();

                        if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist') || firstCol === '0') continue;
                        if (upper.includes('SIGNATURE') || upper.includes('TANDA TANGAN')) continue;

                        // Detect Section Title (Large font / All Caps)
                        const isTitle = firstCol === upper && firstCol.length > 5 && !upper.includes('TIME') && !upper.includes('CHECK LIST');
                        
                        // Special detection for specific vehicles like "Wara-Wiri Grand Max D 8749 FH"
                        // These might not be all caps, but they are important titles
                        const isVehicleTitle = (upper.includes('GRAND MAX') || upper.includes('WARA-WIRI') || / [A-Z] \d{4} [A-Z]{1,2}/.test(firstCol));

                        if (isTitle || isVehicleTitle) {
                            let templateName = `Parkir - ${firstCol}`;
                            console.log(`Found Parking Section: ${firstCol}`);

                            currentTemplate = await prisma.checklistTemplate.create({
                                data: { name: templateName, department: dept, dayOfWeek: null }
                            });
                            
                            // Create an initial category for this template
                            currentCategory = await prisma.checklistCategoryTemplate.create({
                                data: { templateId: currentTemplate.id, name: firstCol, order: 1 }
                            });
                            qOrder = 1;
                            continue;
                        }

                        // Add Questions to current active template
                        if (currentCategory && upper !== 'TIME CHECKING' && upper !== 'CHECK LIST' && upper !== 'YES' && upper !== 'NO') {
                            let type = 'BOOLEAN';
                            if (firstCol.includes('____') || firstCol.includes('Number of') || firstCol.includes('Jumlah') || firstCol.includes('Time') || firstCol.includes(':')) {
                                type = 'TEXT'; // Vehicles often need text input for names/types
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
                    continue;
                }

                // Special handling for Cashier
                if (dept === 'Cashier') {
                    const worksheet = workbook.Sheets[sheetName];
                    const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    const sections = [
                        'Counter Ticket', 
                        'Funicular', 
                        'Hot Air Baloon & Tenant', 
                        'Valley Swing', 
                        'Funswing', 
                        'Zibike', 
                        'Operator Photo', 
                        'Room Driver', 
                        'Point Briefing',
                        'GUEST COMPLATIONS & INCIDENTS'
                    ];

                    const templateMap = {};
                    for (const s of sections) {
                        for (const type of ['Opening', 'Closing']) {
                            const name = `Cashier - ${type} - ${s}`;
                            const t = await prisma.checklistTemplate.create({
                                data: { name, department: dept, dayOfWeek: null }
                            });
                            templateMap[`${type.toUpperCase()}-${s.toUpperCase()}`] = t.id;
                        }
                    }
                    const invT = await prisma.checklistTemplate.create({
                        data: { name: 'Cashier - Inventory & Stock', department: dept, dayOfWeek: null }
                    });
                    const genT = await prisma.checklistTemplate.create({
                        data: { name: 'Cashier - General Cashier', department: dept, dayOfWeek: null }
                    });

                    let currentOutlet = null;
                    let currentSession = null;
                    let currentCategory = null;
                    let qOrder = 1;

                    for (const row of allData) {
                        if (!row || row.length === 0) continue;
                        const firstCol = String(row[0] || '').trim();
                        const upper = firstCol.toUpperCase();
                        if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist') || firstCol === '0') continue;
                        if (upper.includes('SIGNATURE') || upper.includes('TANDA TANGAN')) continue;

                        const matchedOutlet = sections.find(s => upper.includes(s.toUpperCase()));
                        if (matchedOutlet) {
                            currentOutlet = matchedOutlet;
                            currentSession = null;
                            continue;
                        }

                        if (upper === 'OPENING' || upper === 'CLOSING') {
                            currentSession = upper;
                            const templateId = templateMap[`${currentSession}-${currentOutlet?.toUpperCase()}`];
                            if (templateId) {
                                currentCategory = await prisma.checklistCategoryTemplate.create({
                                    data: { templateId: templateId, name: `${currentSession} - ${currentOutlet}`, order: 1 }
                                });
                                qOrder = 1;
                            }
                            continue;
                        }

                        if (upper.includes('INVENTORY') || upper.includes('STOCK')) {
                            currentOutlet = 'INVENTORY';
                            currentCategory = await prisma.checklistCategoryTemplate.create({
                                data: { templateId: invT.id, name: 'INVENTORY & STOCK', order: 1 }
                            });
                            qOrder = 1;
                            continue;
                        }

                        if (upper.includes('GENERAL') || upper.includes('KESIMPULAN')) {
                            currentOutlet = 'GENERAL';
                            currentCategory = await prisma.checklistCategoryTemplate.create({
                                data: { templateId: genT.id, name: 'GENERAL', order: 1 }
                            });
                            qOrder = 1;
                            continue;
                        }

                        if (currentCategory && firstCol !== 'Check list' && firstCol !== 'Time Checking' && firstCol !== 'YES' && firstCol !== 'NO') {
                            let type = 'BOOLEAN';
                            if (firstCol.includes('____') || firstCol.includes('Number of') || firstCol.includes('Jumlah') || firstCol.includes('Time')) {
                                type = 'NUMBER';
                            }
                            await prisma.checklistQuestionTemplate.create({
                                data: { categoryId: currentCategory.id, question: firstCol, type: type, order: qOrder++ }
                            });
                        }
                    }
                    continue;
                }

                const templateName = isDaySheet ? `${dept} (${cleanSheetName})` : (workbook.SheetNames.length > 1 ? `${dept} - ${cleanSheetName}` : dept);
                const template = await prisma.checklistTemplate.create({
                    data: { name: templateName, department: dept, dayOfWeek: isDaySheet ? cleanSheetName : null }
                });
                await createQuestionsForTemplate(template, workbook.Sheets[sheetName]);
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
