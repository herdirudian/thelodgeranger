const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

router.get('/', verifyToken, isAdmin, settingsController.getSettings);
router.post('/', verifyToken, isAdmin, settingsController.updateSettings);
router.post('/test-wa', verifyToken, isAdmin, settingsController.testWhatsApp);

module.exports = router;
