const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const checklistDir = 'C:\\xampp\\htdocs\\familythelodge\\Checklist';
const files = fs.readdirSync(checklistDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

files.forEach(file => {
    console.log(`--- Structure for: ${file} ---`);
    try {
        const workbook = XLSX.readFile(path.join(checklistDir, file));
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Print first 5 rows to understand the structure
        data.slice(0, 10).forEach((row, i) => {
            console.log(`Row ${i}:`, row);
        });
    } catch (e) {
        console.log(`Error reading ${file}: ${e.message}`);
    }
    console.log('\n');
});
