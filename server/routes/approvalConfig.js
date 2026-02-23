const express = require('express');
const router = express.Router();
const controller = require('../controllers/approvalConfigController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

router.get('/', [verifyToken, isAdmin], controller.getConfigs);
router.get('/:id', [verifyToken, isAdmin], controller.getConfigById);
router.post('/', [verifyToken, isAdmin], controller.createConfig);
router.put('/:id', [verifyToken, isAdmin], controller.updateConfig);
router.delete('/:id', [verifyToken, isAdmin], controller.deleteConfig);

module.exports = router;

