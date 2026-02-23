const express = require('express');
const router = express.Router();
const controller = require('../controllers/review360Controller');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

router.get('/assignments/mine', verifyToken, controller.getMyAssignments);
router.get('/assignments/:id', verifyToken, controller.getAssignmentDetail);
router.post('/assignments/:id/submit', verifyToken, controller.submitAssignment);

router.get('/admin/forms', [verifyToken, isAdmin], controller.adminListForms);
router.get('/admin/forms/:id', [verifyToken, isAdmin], controller.adminGetFormDetail);
router.post('/admin/forms', [verifyToken, isAdmin], controller.adminCreateForm);
router.put('/admin/forms/:id', [verifyToken, isAdmin], controller.adminUpdateForm);
router.delete('/admin/forms/:id', [verifyToken, isAdmin], controller.adminDeleteForm);

module.exports = router;
