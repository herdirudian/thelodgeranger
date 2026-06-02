const XLSX = require('xlsx');
const path = require('path');

const file = 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist\\06. IT Checklist 2026.xlsx';
try {
    const workbook = XLSX.readFile(file);
    console.log('Sheet Names:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n--- Content for Sheet: ${sheetName} ---`);
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        data.slice(0, 20).forEach((row, i) => {
            console.log(`Row ${i}:`, row);
        });
    });
} catch (e) {
    console.log(`Error: ${e.message}`);
}
