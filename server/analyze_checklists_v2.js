const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const checklistDir = 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist';
const files = fs.readdirSync(checklistDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

const results = {};

files.forEach(file => {
    const deptName = file.split('.')[1] ? file.split('.')[1].split('Daily')[0].trim() : file.split('.')[0].trim();
    results[deptName] = {
        categories: []
    };

    try {
        const workbook = XLSX.readFile(path.join(checklistDir, file));
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let currentCategory = "General";
        
        data.forEach(row => {
            if (!row || row.length === 0) return;
            
            const firstCol = String(row[0] || '').trim();
            if (!firstCol || firstCol === 'THE LODGE MARIBAYA' || firstCol.includes('Checklist') || firstCol === 'Date') return;

            // Detect Category (Usually Uppercase or has specific keywords)
            if (firstCol === firstCol.toUpperCase() && firstCol.length > 3 && !firstCol.includes('TIME')) {
                currentCategory = firstCol;
                if (!results[deptName].categories.find(c => c.name === currentCategory)) {
                    results[deptName].categories.push({ name: currentCategory, items: [] });
                }
            } else {
                let cat = results[deptName].categories.find(c => c.name === currentCategory);
                if (!cat) {
                    cat = { name: currentCategory, items: [] };
                    results[deptName].categories.push(cat);
                }
                
                // Add Item if it's not a header row
                if (firstCol !== 'Check list' && firstCol !== 'Time Checking' && !firstCol.startsWith('Row')) {
                    cat.items.push(firstCol);
                }
            }
        });
    } catch (e) {
        // Error
    }
});

console.log(JSON.stringify(results, null, 2));
