const express = require('express');
const router = express.Router();
const controller = require('../controllers/analyticsController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

// All analytics routes require Auth. 
// Ideally restrict to HR/GM, but HOD might need some too.
// For now, let's verify token at least.

router.get('/attendance-stats', verifyToken, controller.getDepartmentAttendance);
router.get('/lateness', verifyToken, controller.getLateEmployees);
router.get('/request-trends', verifyToken, controller.getRequestTrends);

module.exports = router;
