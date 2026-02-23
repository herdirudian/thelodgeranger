const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const { verifyToken, isAdmin, isHOD } = require('../middleware/authJwt');

// All routes require Admin (HR or GM) access, except reading users which HOD can do
router.get('/public/:id', controller.getPublicUserProfile); // Public route for feedback
router.get('/expiring', [verifyToken, isAdmin], controller.getExpiringContracts);
router.get('/', [verifyToken, isHOD], controller.getAllUsers);
router.get('/colleagues', [verifyToken], controller.getColleagues); // All staff can access
router.post('/', [verifyToken, isAdmin], controller.createUser);
router.put('/:id', [verifyToken, isAdmin], controller.updateUser);
router.delete('/:id', [verifyToken, isAdmin], controller.deleteUser);
// WhatsApp verification
router.post('/wa/send-code', [verifyToken], controller.sendWhatsAppCode);
router.post('/wa/verify-code', [verifyToken], controller.verifyWhatsAppCode);
router.get('/wa/status', [verifyToken, isAdmin], controller.getWhatsAppStatus);

module.exports = router;
