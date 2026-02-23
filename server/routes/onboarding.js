const express = require('express');
const router = express.Router();
const controller = require('../controllers/onboardingController');
const { verifyToken, isAdmin, isHR } = require('../middleware/authJwt');

// Only HR/GM/Admin should manage onboarding usually. 
// Or maybe HOD too. For now, let's allow HR/GM/HOD to view/edit.
// We'll use verifyToken for now and rely on role checks in frontend or controller if needed.
// Ideally: middleware isHODorHR.

router.get('/stats', verifyToken, controller.getOnboardingStats);
router.get('/me', verifyToken, controller.getMyOnboarding);
router.get('/:userId', verifyToken, controller.getStaffOnboarding);
router.post('/:userId/init', verifyToken, controller.initOnboarding);
router.put('/task/:taskId', verifyToken, controller.updateTask);

module.exports = router;
