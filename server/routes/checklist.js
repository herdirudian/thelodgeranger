const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { verifyToken } = require('../middleware/authJwt');

router.get('/templates', [verifyToken], checklistController.getTemplates);
router.post('/submit', [verifyToken], checklistController.submitChecklist);
router.get('/submissions', [verifyToken], checklistController.getSubmissions);
router.put('/submissions/:id/sign', [verifyToken], checklistController.signChecklist);
router.post('/export/csv', [verifyToken], checklistController.exportChecklistCsv);
router.post('/export/pdf', [verifyToken], checklistController.exportChecklistPdf);

// Admin Routes
router.get('/admin/templates', [verifyToken], checklistController.adminGetTemplates);
router.post('/admin/templates', [verifyToken], checklistController.createTemplate);
router.post('/admin/templates/:id/duplicate', [verifyToken], checklistController.duplicateTemplate);
router.post('/admin/templates/:id/assign', [verifyToken], checklistController.assignUsers);
router.put('/admin/templates/:id', [verifyToken], checklistController.updateTemplate);
router.delete('/admin/templates/:id', [verifyToken], checklistController.deleteTemplate);

router.post('/admin/categories', [verifyToken], checklistController.createCategory);
router.put('/admin/categories/:id', [verifyToken], checklistController.updateCategory);
router.delete('/admin/categories/:id', [verifyToken], checklistController.deleteCategory);

router.post('/admin/questions', [verifyToken], checklistController.createQuestion);
router.put('/admin/questions/:id', [verifyToken], checklistController.updateQuestion);
router.delete('/admin/questions/:id', [verifyToken], checklistController.deleteQuestion);

module.exports = router;
