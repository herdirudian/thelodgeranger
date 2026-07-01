const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const checklistDir = 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist';
const specificFiles = [
    '02. Cashier Daily Checklist 2026.xlsx',
    '03.Room Checklist The Lodge Camp & Village.xlsx',
    '04. Parking & Driver Daily Checklist 2026.xlsx'
];

specificFiles.forEach(file => {
    const filePath = path.join(checklistDir, file);
    if (fs.existsSync(filePath)) {
        try {
            const workbook = XLSX.readFile(filePath);
            console.log(`\n--- ${file} ---`);
            console.log('Sheets:', workbook.SheetNames);
            
            // Peek at first few rows of the first sheet
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            console.log('Sample Data (Sheet 1):');
            data.slice(0, 10).forEach((row, i) => console.log(`Row ${i}:`, row));
        } catch (e) {
            console.log(`Error reading ${file}: ${e.message}`);
        }
    } else {
        console.log(`File not found: ${file}`);
    }
});
