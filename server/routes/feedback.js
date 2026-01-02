const express = require('express');
const router = express.Router();
const controller = require('../controllers/feedbackController');
const { verifyToken } = require('../middleware/authJwt');

router.post('/', controller.createFeedback); // Public
router.get('/', [verifyToken], controller.getFeedback);
router.get('/export', [verifyToken], controller.exportFeedback);

module.exports = router;
