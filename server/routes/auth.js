const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');
const { verifyToken } = require('../middleware/authJwt');

router.post('/signup', [verifyToken], controller.signup); // Protected signup, usually only admin can create users or self-registration if allowed
router.post('/signin', controller.signin);
router.post('/forgot-password', controller.forgotPassword);
router.post('/verify-reset-code', controller.verifyResetCode);
router.post('/reset-password', controller.resetPassword);
router.get('/me', [verifyToken], controller.me);

module.exports = router;
