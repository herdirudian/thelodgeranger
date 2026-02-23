const express = require('express');
const router = express.Router();
const controller = require('../controllers/bugReportController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

router.post('/', [verifyToken], controller.createBugReport);
router.post('/device', [verifyToken], controller.createDeviceErrorLog);
router.get('/', [verifyToken, isAdmin], controller.getBugReports);
router.get('/me', [verifyToken], controller.getMyBugReports);
router.put('/:id/status', [verifyToken, isAdmin], controller.updateBugReportStatus);

module.exports = router;
