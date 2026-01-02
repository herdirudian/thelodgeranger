const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendanceController');
const { verifyToken, isHOD } = require('../middleware/authJwt');
const multer = require('multer');
const path = require('path');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'attendance-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/', [verifyToken, upload.single('photo')], controller.clockIn);
router.get('/me', [verifyToken], controller.getHistory);
router.get('/team', [verifyToken, isHOD], controller.getTeamAttendance);
router.get('/pending', [verifyToken, isHOD], controller.getPendingAttendance);
router.get('/history', [verifyToken], controller.getApprovalHistory);
router.put('/:id/status', [verifyToken, isHOD], controller.updateStatus);
router.get('/:id/pdf', [verifyToken], controller.getAttendancePDF);

module.exports = router;
