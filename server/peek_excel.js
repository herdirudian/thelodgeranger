const XLSX = require('xlsx');
const path = require('path');

const file = 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist\\06. IT Checklist 2026.xlsx';
try {
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`Content for ${file}:`);
    data.slice(0, 20).forEach((row, i) => {
        console.log(`Row ${i}:`, row);
    });
} catch (e) {
    console.log(`Error: ${e.message}`);
}
