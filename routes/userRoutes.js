const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/auth', authController.auth);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword', authController.verifiyPasswordResetPIN, authController.resetPassword);
router.post('/verifiyPasswordResetPIN', authController.verifiyPasswordResetPIN, ( req, res ) => {
  res.status(200).json({
    status: 'success',
    message: 'PIN is correct'
  });
});
// Protect all routes after this middleware
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
router.patch(
  '/updateMe',
  userController.updateMe
);
router.delete('/deleteMe', userController.deleteMe);
router.post('/points', userController.addPoints);
router.get('/points', userController.getPoints);
router.get('/points/week', userController.getPointsWeek);
router.get('/sections', userController.getSections);
router.post('/sections', userController.sectionUpdate);

router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;