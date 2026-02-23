const express = require('express');
const router = express.Router();
const controller = require('../controllers/analyticsController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

// All analytics routes require Auth. 
// Ideally restrict to HR/GM, but HOD might need some too.
// For now, let's verify token at least.

router.get('/departments', verifyToken, controller.getDepartments);
router.get('/attendance-stats', verifyToken, controller.getDepartmentAttendance);
router.get('/lateness', verifyToken, controller.getLateEmployees);
router.get('/request-trends', verifyToken, controller.getRequestTrends);
router.get('/recap', verifyToken, controller.getRecapStats);
router.get('/employee-recap', verifyToken, controller.getEmployeeRecap);
router.get('/approved-history', verifyToken, controller.getApprovedRequestHistory);
router.get('/export', verifyToken, controller.exportRecap);

module.exports = router;
