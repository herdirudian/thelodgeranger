const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only images and PDFs are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadFields = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]);

// Routes
router.post('/', [verifyToken, isAdmin, uploadFields], controller.createAnnouncement);
router.get('/', [verifyToken], controller.getAnnouncements);
router.put('/:id', [verifyToken, isAdmin, uploadFields], controller.updateAnnouncement);
router.delete('/:id', [verifyToken, isAdmin], controller.deleteAnnouncement);

module.exports = router;
