const express = require('express');
const router = express.Router();
const controller = require('../controllers/idpController');
const referenceController = require('../controllers/idpReferenceController');
const { verifyToken, isHOD } = require('../middleware/authJwt');

router.get('/me', verifyToken, controller.getMyIDPs);
router.post('/', verifyToken, controller.createMyIDP);
router.get('/manage', [verifyToken, isHOD], controller.listIDPs);
router.get('/reference/guidelines', verifyToken, referenceController.getGuidelines);
router.get('/reference/idp-guidelines', verifyToken, referenceController.getIdpGuidelinesXlsx);
router.get('/reference/sample', verifyToken, referenceController.getSample);
router.get('/reference/competencies', verifyToken, referenceController.getCompetencies);
router.get('/:id', verifyToken, controller.getIDPById);
router.put('/:id', verifyToken, controller.updateIDPById);
router.post('/:id/submit', verifyToken, controller.submitIDP);
router.post('/:id/approve', verifyToken, controller.approveIDP);
router.post('/:id/reject', verifyToken, controller.rejectIDP);

module.exports = router;
