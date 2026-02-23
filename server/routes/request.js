const express = require('express');
const router = express.Router();
const controller = require('../controllers/requestController');
const { verifyToken } = require('../middleware/authJwt');

router.post('/', [verifyToken], controller.createRequest);
router.get('/me', [verifyToken], controller.getMyRequests);
router.get('/pending', [verifyToken], controller.getPendingRequests);
router.get('/export', [verifyToken], controller.exportRequests);
router.get('/history', [verifyToken], controller.getApprovalHistory);
router.get('/:id/pdf', [verifyToken], controller.downloadRequestPDF);
router.put('/:id/approval', [verifyToken], controller.approveRequest);
router.delete('/:id', [verifyToken], controller.deleteRequest);
// Admin/GM utility to auto-approve requests stuck in PENDING_GM where GM is not required by config
router.post('/admin/fix-pending-gm', [verifyToken], controller.fixPendingGMRequests);

module.exports = router;
