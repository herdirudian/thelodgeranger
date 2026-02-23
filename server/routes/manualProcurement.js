const express = require('express');
const router = express.Router();
const controller = require('../controllers/manualProcurementController');
const { verifyToken } = require('../middleware/authJwt');

router.post('/', [verifyToken], controller.createManualProcurement);
router.get('/', [verifyToken], controller.getManualProcurements);
router.get('/export', [verifyToken], controller.exportManualProcurements);
router.get('/:id', [verifyToken], controller.getManualProcurementById);
router.put('/:id', [verifyToken], controller.updateManualProcurement);
router.put('/:id/approval', [verifyToken], controller.approveManualProcurement);
router.put('/:id/status', [verifyToken], controller.updateStatus);

module.exports = router;
