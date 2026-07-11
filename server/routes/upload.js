const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Configuration
const storage = multer.memoryStorage(); // Switch to memory storage to process with sharp

const fileFilter = (req, file, cb) => {
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only images and PDFs are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Single file upload route
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        let filename = 'upload-' + uniqueSuffix + path.extname(req.file.originalname);
        const filePath = path.join(uploadDir, filename);

        // Auto-compress if it's an image
        if (req.file.mimetype.startsWith('image/')) {
            // Always convert to jpeg for best compression, or keep original ext if preferred
            // Here we keep original ext but compress quality
            const ext = path.extname(req.file.originalname).toLowerCase();
            
            let sharpInstance = sharp(req.file.buffer)
                .rotate() // Auto-rotate based on EXIF
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }); // Resize to max 1200px

            if (ext === '.png') {
                await sharpInstance.png({ quality: 80, compressionLevel: 8 }).toFile(filePath);
            } else {
                // Default to jpeg/webp for others
                filename = 'upload-' + uniqueSuffix + '.jpg';
                const newPath = path.join(uploadDir, filename);
                await sharpInstance.jpeg({ quality: 75, mozjpeg: true }).toFile(newPath);
            }
        } else {
            // Non-image (like PDF), just write buffer
            fs.writeFileSync(filePath, req.file.buffer);
        }
        
        // Return the URL
        const fileUrl = `/uploads/${filename}`;
        res.status(200).json({ url: fileUrl, filename: filename });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Error uploading file', error: error.message });
    }
});

// Route to serve files dynamically to bypass potential proxy issues with static files
router.get('/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(uploadDir, filename);
        
        console.log(`[FileServer] Requesting: ${filename}`);
        console.log(`[FileServer] Checking path: ${filePath}`);

        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }

        // Smart search: try with prefixes if original not found
        const prefixes = ['upload-', 'attendance-'];
        for (const prefix of prefixes) {
            const alternativePath = path.join(uploadDir, prefix + filename);
            console.log(`[FileServer] Trying alternative: ${alternativePath}`);
            if (fs.existsSync(alternativePath)) {
                return res.sendFile(alternativePath);
            }
        }

        console.error(`[FileServer] File NOT FOUND: ${filename}`);
        res.status(404).json({ message: 'File not found', checkedPath: filePath });
    } catch (error) {
        console.error(`[FileServer] Error: ${error.message}`);
        res.status(500).json({ message: 'Error retrieving file', error: error.message });
    }
});

module.exports = router;
