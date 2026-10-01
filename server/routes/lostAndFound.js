const express = require('express');
const router = express.Router();
const controller = require('../controllers/lostAndFoundController');
const { verifyToken } = require('../middleware/authJwt');

// All routes require authenticated user
router.get('/stats', [verifyToken], controller.getStats);
router.get('/', [verifyToken], controller.getAllItems);
router.get('/:id', [verifyToken], controller.getItemById);
router.post('/', [verifyToken], controller.createItem);
router.put('/:id', [verifyToken], controller.updateItem);
router.put('/:id/claim', [verifyToken], controller.claimItem);
router.put('/:id/final-action', [verifyToken], controller.finalActionItem);
router.delete('/:id', [verifyToken], controller.deleteItem);

module.exports = router;
