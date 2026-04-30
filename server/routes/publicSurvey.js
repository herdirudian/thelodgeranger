const express = require('express');
const router = express.Router();
const controller = require('../controllers/publicSurveyController');
const { verifyToken } = require('../middleware/authJwt');

// Protected report & access management (place BEFORE wildcard route)
router.get('/report', verifyToken, controller.report);
router.get('/access', verifyToken, controller.listAccess);
router.post('/access', verifyToken, controller.grantAccess);
router.delete('/access/:id', verifyToken, controller.revokeAccess);
router.get('/allowed', verifyToken, controller.allowed);

// Public endpoints (no auth)
router.get('/export', controller.export); // optional export
router.get('/export-xlsx', controller.exportXlsx);
router.post('/:type', controller.submit);

module.exports = router;
