const express = require('express');
const router = express.Router();
const controller = require('../controllers/learningController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

// User Routes
router.get('/modules', verifyToken, controller.getModules);
router.get('/modules/:id', verifyToken, controller.getModuleDetail);
router.post('/modules/:id/acknowledge', verifyToken, controller.acknowledgeModule);
router.post('/modules/:id/quiz', verifyToken, controller.submitQuiz);
router.get('/modules/:id/submissions', verifyToken, controller.getMySubmissions);
router.get('/history', verifyToken, controller.getMyHistory);
router.get('/admin/submissions', [verifyToken, isAdmin], controller.getAllSubmissions);
router.delete('/admin/submissions/:id', [verifyToken, isAdmin], controller.deleteSubmission);

// Admin Routes (HR/GM/Admin)
// TODO: Use isAdmin or isHR middleware for strict access
router.post('/admin/modules', [verifyToken, isAdmin], controller.createModule);
router.put('/admin/modules/:id', [verifyToken, isAdmin], controller.updateModule);
router.delete('/admin/modules/:id', [verifyToken, isAdmin], controller.deleteModule);
router.post('/admin/modules/:moduleId/quiz', [verifyToken, isAdmin], controller.createQuiz);
router.put('/admin/modules/:moduleId/quiz', [verifyToken, isAdmin], controller.updateQuiz);

module.exports = router;
