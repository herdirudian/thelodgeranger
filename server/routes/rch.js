const express = require('express');
const router = express.Router();
const rchController = require('../controllers/rchController');
const { verifyToken, isHOD, isAdmin } = require('../middleware/authJwt');

// All authenticated users can view RCH (or maybe restrict later)
router.get('/', verifyToken, rchController.getAllRch);
router.get('/:id', verifyToken, rchController.getRchById);

// Users who are selected/allowed can create. For now, we allow authenticated users to create.
router.post('/', verifyToken, rchController.createRch);

// Update and Delete might be restricted to HOD or Admin
router.put('/:id', verifyToken, rchController.updateRch);
router.delete('/:id', [verifyToken, isAdmin], rchController.deleteRch);

module.exports = router;
