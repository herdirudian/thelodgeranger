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
router.get('/monthly/:id/grid', [verifyToken, isHOD], controller.getMonthlyScheduleGrid);
router.post('/monthly/:id/approve', [verifyToken, isHOD], controller.approveMonthlySchedule);
router.post('/monthly/:id/refresh', [verifyToken, isHOD], controller.refreshScheduleShifts);
router.post('/monthly/:id/sync-requests', [verifyToken, isHOD], controller.syncApprovedRequestsToMonthly);
router.post('/monthly/:id/revise', [verifyToken, isHOD], controller.reviseMonthlySchedule);
router.post('/monthly/:id/hr-adjust', [verifyToken, isAdmin], controller.hrAdjustMonthlySchedule);

module.exports = router;
