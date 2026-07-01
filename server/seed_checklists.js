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

                // Special handling for Parking to create per-area and per-vehicle templates
                if (dept === 'Parkir') {
                    const worksheet = workbook.Sheets[sheetName];
                    const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // Areas
                    const parkingAreas = [
                        { name: 'Area Parkir Umum', keywords: ['PARKIR UMUM'] },
                        { name: 'Area Parkir Cikebul', keywords: ['CIKEBUL'] },
                        { name: 'Area Parkir Fairy Garden', keywords: ['FAIRY GARDEN', 'FG'] }
                    ];

                    // Vehicles (Let's create 5 slots for vehicles for now, or based on the Excel)
                    const vehicleUnits = [
                        { name: 'Kendaraan 1', id: 1 },
                        { name: 'Kendaraan 2', id: 2 },
                        { name: 'Kendaraan 3', id: 3 },
                        { name: 'Kendaraan 4', id: 4 },
                        { name: 'Kendaraan 5', id: 5 }
                    ];

                    // Create Area Templates
                    for (const area of parkingAreas) {
                        const template = await prisma.checklistTemplate.create({
                            data: { name: `Parkir - ${area.name}`, department: dept, dayOfWeek: null }
                        });
                        
                        let currentCategory = null;
                        let isMatch = false;
                        let qOrder = 1;

                        for (const row of allData) {
                            if (!row || row.length === 0) continue;
                            const firstCol = String(row[0] || '').trim();
                            const upper = firstCol.toUpperCase();

                            if (upper.includes('SIGNATURE') || upper.includes('TANDA TANGAN')) continue;
                            if (upper === 'OPENING CHECKLIST') continue;

                            if (firstCol === upper && firstCol.length > 3 && !upper.includes('TIME')) {
                                isMatch = area.keywords.some(k => upper.includes(k));
                                if (isMatch) {
                                    currentCategory = await prisma.checklistCategoryTemplate.create({
                                        data: { templateId: template.id, name: firstCol, order: 1 }
                                    });
                                    qOrder = 1;
                                }
                            } else if (currentCategory && isMatch) {
                                if (upper === 'TIME CHECKING' || upper === 'CHECK LIST') continue;
                                await prisma.checklistQuestionTemplate.create({
                                    data: { categoryId: currentCategory.id, question: firstCol, type: 'BOOLEAN', order: qOrder++ }
                                });
                            }
                        }
                    }

                    // Create Vehicle Templates
                    // In Excel, vehicles repeat under "CHECKLIST KENDARAAN OPERASIONAL"
                    // We'll extract one full set of vehicle questions and apply to each unit
                    const vehicleQuestions = [];
                    let inVehicleSection = false;
                    let tempCat = null;

                    for (const row of allData) {
                        const firstCol = String(row[0] || '').trim();
                        const upper = firstCol.toUpperCase();
                        if (upper.includes('KENDARAAN OPERASIONAL')) { inVehicleSection = true; continue; }
                        if (inVehicleSection) {
                            if (upper.includes('JENIS KENDARAAN') || upper.includes('NAMA UNIT')) {
                                vehicleQuestions.push({ cat: 'INFO', q: firstCol, type: 'TEXT' });
                            } else if (firstCol === upper && firstCol.length > 3 && !upper.includes('TIME') && !upper.includes('STATUS')) {
                                tempCat = firstCol;
                            } else if (tempCat && firstCol !== upper && !upper.includes('TIME') && !upper.includes('STATUS')) {
                                vehicleQuestions.push({ cat: tempCat, q: firstCol, type: 'BOOLEAN' });
                            }
                            if (upper.includes('STATUS KENDARAAN')) {
                                vehicleQuestions.push({ cat: 'STATUS', q: firstCol, type: 'TEXT' });
                                break; // Just take the first vehicle's question set
                            }
                        }
                    }

                    for (const unit of vehicleUnits) {
                        const template = await prisma.checklistTemplate.create({
                            data: { name: `Parkir - ${unit.name}`, department: dept, dayOfWeek: null }
                        });
                        
                        let lastCatName = "";
                        let currentCat = null;
                        let qOrder = 1;

                        for (const vq of vehicleQuestions) {
                            if (vq.cat !== lastCatName) {
                                currentCat = await prisma.checklistCategoryTemplate.create({
                                    data: { templateId: template.id, name: vq.cat, order: 1 }
                                });
                                lastCatName = vq.cat;
                                qOrder = 1;
                            }
                            await prisma.checklistQuestionTemplate.create({
                                data: { categoryId: currentCat.id, question: vq.q, type: vq.type, order: qOrder++ }
                            });
                        }
                    }
                    continue;
                }
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

                    // Map to store templates: { "OPENING-COUNTER TICKET": templateId }
                    const templateMap = {};
                    
                    // First, create all possible templates for Cashier
                    for (const s of sections) {
                        for (const type of ['Opening', 'Closing']) {
                            const name = `Cashier - ${type} - ${s}`;
                            const t = await prisma.checklistTemplate.create({
                                data: { name, department: dept, dayOfWeek: null }
                            });
                            templateMap[`${type.toUpperCase()}-${s.toUpperCase()}`] = t.id;
                        }
                    }
                    
                    // Create Inventory and General templates
                    const invT = await prisma.checklistTemplate.create({
                        data: { name: 'Cashier - Inventory & Stock', department: dept, dayOfWeek: null }
                    });
                    const genT = await prisma.checklistTemplate.create({
                        data: { name: 'Cashier - General Cashier', department: dept, dayOfWeek: null }
                    });

                    let currentOutlet = null;
                    let currentSession = null; // OPENING or CLOSING
                    let currentCategory = null;
                    let qOrder = 1;

                    for (const row of allData) {
                        if (!row || row.length === 0) continue;
                        const firstCol = String(row[0] || '').trim();
                        const upper = firstCol.toUpperCase();

                        if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol === 'Date' || firstCol.includes('Checklist') || firstCol === '0') continue;
                        if (upper.includes('SIGNATURE') || upper.includes('TANDA TANGAN')) continue;

                        // 1. Detect Outlet (Loose matching for robustness)
                        const matchedOutlet = sections.find(s => upper.includes(s.toUpperCase()));
                        if (matchedOutlet) {
                            currentOutlet = matchedOutlet;
                            currentSession = null; // Reset session when outlet changes
                            console.log(`Found Outlet: ${currentOutlet}`);
                            continue;
                        }

                        // 2. Detect Session (OPENING/CLOSING)
                        if (upper === 'OPENING' || upper === 'CLOSING') {
                            currentSession = upper;
                            const templateId = templateMap[`${currentSession}-${currentOutlet?.toUpperCase()}`];
                            
                            if (templateId) {
                                // Create a category for this session in this outlet
                                currentCategory = await prisma.checklistCategoryTemplate.create({
                                    data: {
                                        templateId: templateId,
                                        name: `${currentSession} - ${currentOutlet}`,
                                        order: 1
                                    }
                                });
                                qOrder = 1;
                                console.log(`  -> Starting Session: ${currentSession} for ${currentOutlet}`);
                            }
                            continue;
                        }

                        // 3. Detect Inventory/General
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

                        // 4. Add Questions
                        if (currentCategory && firstCol !== 'Check list' && firstCol !== 'Time Checking' && firstCol !== 'YES' && firstCol !== 'NO') {
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
