const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');
const { OAuth2Client } = require('google-auth-library');


const GoogleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);


  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });

  await new Email(newUser).sendWelcome();

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything ok, send token to client
  createSendToken(user, 200, req, res);
});


exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});




exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetPin = user.createPasswordResetPIN();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    
    await new Email(user).sendPasswordReset(resetPin);

    res.status(200).json({
      status: 'success',
      message: 'PIN sent to email!'
    });
  } catch (err) {
    user.passwordResetPIN = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {

  if(!req.body.pin)
  {
    return next(new AppError('Please provide a PIN', 400));
  }

  const hashedPIN = crypto
    .createHash('sha256')
    .update(req.body.pin)
    .digest('hex');



  const user = await User.findOne({
    email: req.body.email,
  });

  if(!user)
  {
    return next(new AppError('No user found with this email', 404));
  }

  if(user.passwordResetPIN !== hashedPIN || user.passwordResetExpires < Date.now())
  {
    return next(new AppError('Invalid or expired PIN', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetPIN = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);


});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  if(!req.body.password || !req.body.passwordConfirm || !req.body.passwordCurrent)
  {
    return next(new AppError('Please provide all the fields', 400));
  }

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});


exports.verifiyPasswordResetPIN = catchAsync(async (req, res, next) => {

  if(!req.body.pin) {
    return next(new AppError('Please provide a PIN', 400));
  }


  const hashedPIN = crypto
    .createHash('sha256')
    .update(req.body.pin)
    .digest('hex');

  const user = await User.findOne({
    email: req.body.email,
  });

  if(!user)
  {
    return next(new AppError('No user found with this email', 404));
  }

  if(user.passwordResetPINAttempts >= 5)
  {
    return next(new AppError('Too many attempts, request new PIN', 400));
  }

  
  if(user.passwordResetPIN !== hashedPIN || user.passwordResetExpires < Date.now())
  {
    await User.findOneAndUpdate({email: req.body.email}, {passwordResetPINAttempts: user.passwordResetPINAttempts + 1});
    return next(new AppError('Invalid or expired PIN', 400));
  }

  return next();

})


exports.auth = catchAsync(async (req, res, next) => {

  const email = req.body.email;
  const name = req.body.name;

  if(!email || !name)
  {
    return next(new AppError('Please provide email and name', 400));
  }

  const user = await User.findOne({
    email: email
  });

  if(user)
  {
    createSendToken(user, 200, req, res);
  }
  else {
    const password = crypto.randomBytes(16).toString('hex');
    const newUser = await User.create({
      name: name,
      email: email,
      password: password,
      passwordConfirm: password
    });

    createSendToken(newUser, 201, req, res);
  }

});