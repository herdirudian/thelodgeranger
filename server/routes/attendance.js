const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendanceController');
const { verifyToken, isHOD } = require('../middleware/authJwt');
const multer = require('multer');
const path = require('path');
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.warn("Sharp library not found. Image compression will be disabled.");
}
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            console.error('Failed to ensure uploads dir:', e.message);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'attendance-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Middleware to compress image
const compressImage = async (req, res, next) => {
    if (!req.file || !sharp) return next();

    const originalPath = req.file.path;
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const name = path.basename(originalPath, ext);
    const newFilename = `${name}-comp${ext}`;
    const newPath = path.join(dir, newFilename);

    try {
        // Disable sharp cache
        sharp.cache(false);

        await sharp(originalPath)
            .resize({ width: 800, withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(newPath);

        // Update req.file to point to the new file
        req.file.path = newPath;
        req.file.filename = newFilename;
        
        // Try to delete the original file
        try {
            fs.unlinkSync(originalPath);
        } catch (unlinkErr) {
            console.warn("Could not delete original file (locked?):", unlinkErr.message);
            // It's okay, we have the compressed one.
        }
        
        // Update size
        const stats = fs.statSync(newPath);
        req.file.size = stats.size;
        
        next();
    } catch (error) {
        console.error('Error compressing image:', error);
        // If compression failed, we still have the original file at req.file.path
        // Ensure we clean up the new file if it was partially created
        if (fs.existsSync(newPath)) {
            try { fs.unlinkSync(newPath); } catch(e) {}
        }
        // Proceed with original file
        next();
    }
};

// router.post('/', [verifyToken, upload.single('photo'), compressImage], controller.clockIn);
// Temporarily disabled compression to debug "Error clocking in"
router.post('/', [verifyToken, upload.single('photo')], controller.clockIn);
router.get('/me', [verifyToken], controller.getHistory);
router.get('/team', [verifyToken, isHOD], controller.getTeamAttendance);
router.get('/pending', [verifyToken, isHOD], controller.getPendingAttendance);
router.get('/export', [verifyToken], controller.exportAttendance);
router.get('/history', [verifyToken], controller.getApprovalHistory);
router.put('/:id/status', [verifyToken, isHOD], controller.updateStatus);
router.get('/:id/pdf', [verifyToken], controller.getAttendancePDF);
router.delete('/:id', [verifyToken], controller.deleteAttendance);

module.exports = router;
