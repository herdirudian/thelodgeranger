const express = require('express');
const router = express.Router();
const controller = require('../controllers/votingController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

router.get('/ballot', [verifyToken], controller.getBallot);
router.post('/vote', [verifyToken], controller.submitVote);
router.post('/finalize', [verifyToken], controller.finalizeVoting);
router.get('/results', [verifyToken, isAdmin], controller.getResults);
router.get('/admin/rookie-photos', [verifyToken], controller.getRookiePhotos);
router.post('/admin/rookie-photo', [verifyToken, isAdmin], controller.setRookiePhoto);
router.delete('/admin/rookie-photo/:candidateUserId', [verifyToken, isAdmin], controller.deleteRookiePhoto);

module.exports = router;
