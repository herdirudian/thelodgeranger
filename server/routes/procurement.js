const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { verifyToken } = require('../middleware/authJwt');

// Need to update middleware to support SUPERVISOR and FINANCE roles if not generic
// Assuming verifyToken sets req.userRole and we can check roles in controller or create new middleware.
// For now, let's use verifyToken and handle role checks in controller or assume generic access for logged in users.

// Standard CRUD
router.post('/', verifyToken, procurementController.createProcurement);
router.get('/me', verifyToken, procurementController.getMyProcurements);
router.get('/pending', verifyToken, procurementController.getPendingProcurements);
router.get('/history', verifyToken, procurementController.getApprovalHistory);
router.put('/:id/approval', verifyToken, procurementController.approveProcurement);

module.exports = router;
