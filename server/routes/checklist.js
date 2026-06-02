const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { verifyToken } = require('../middleware/authJwt');

router.get('/templates', [verifyToken], checklistController.getTemplates);
router.post('/submit', [verifyToken], checklistController.submitChecklist);
router.get('/submissions', [verifyToken], checklistController.getSubmissions);
router.put('/submissions/:id/sign', [verifyToken], checklistController.signChecklist);

module.exports = router;
