const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');
const { verifyToken, isAdmin, isHOD } = require('../middleware/authJwt');

router.post('/', [verifyToken, isAdmin], controller.createSchedule);
router.get('/me', [verifyToken], controller.getMySchedule);
router.get('/all', [verifyToken, isAdmin], controller.getAllSchedules);

// Monthly Schedule Routes
router.post('/monthly', [verifyToken, isHOD], controller.createMonthlySchedule);
router.get('/monthly', [verifyToken, isHOD], controller.getMonthlySchedules);
router.get('/monthly/:id', [verifyToken, isHOD], controller.getMonthlyScheduleById);
router.get('/monthly/:id/pdf', [verifyToken, isHOD], controller.getMonthlySchedulePDF);
router.post('/monthly/:id/approve', [verifyToken, isHOD], controller.approveMonthlySchedule);

module.exports = router;
