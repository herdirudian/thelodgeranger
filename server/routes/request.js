const express = require('express');
const router = express.Router();
const controller = require('../controllers/requestController');
const { verifyToken } = require('../middleware/authJwt');

router.post('/', [verifyToken], controller.createRequest);
router.get('/me', [verifyToken], controller.getMyRequests);
router.get('/pending', [verifyToken], controller.getPendingRequests);
router.get('/history', [verifyToken], controller.getApprovalHistory);
router.get('/:id/pdf', [verifyToken], controller.downloadRequestPDF);
router.put('/:id/approval', [verifyToken], controller.approveRequest);

module.exports = router;
