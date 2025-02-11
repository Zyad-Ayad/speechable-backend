const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');
const { parse } = require('path');
const Points = require('./../models/pointsModel');



const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead'
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

exports.addPoints = catchAsync(async (req, res, next) => {

  let pointsToAdd;
  try {
    pointsToAdd = parseInt(req.body.points);
  }
  catch(err) {
    return next(new AppError('Please provide a valid number', 400));
  }

  if(pointsToAdd < 0) {
    return next(new AppError('Please provide a valid number', 400));
  }

  const Olduser = await User.findById(req.user.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try to update today's document if it exists
  let todayDoc = await Points.findOneAndUpdate(
    { user: req.user.id, date: today },
    { $inc: { points: pointsToAdd } },
    { new: true }
  );

   // If no record for today exists, create one
   if (!todayDoc) {
    todayDoc = new Points({ user: req.user.id, date: today, points: pointsToAdd });
    await todayDoc.save();
  }

  const user = await  User.findByIdAndUpdate(req.user.id, { points: Olduser.points + pointsToAdd }, {
    new : true,
  });


  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });

});


exports.getPoints = catchAsync(async (req, res, next) => {
  const points = await Points.find({ user: req.user.id })
    .select('-_id -__v -user')
    .sort('date');
  res.status(200).json({
    status: 'success',
    data: {
      points
    }
  });
});

exports.getPointsWeek = catchAsync(async (req, res, next) => {

  const today = new Date();
today.setHours(0, 0, 0, 0);

// Get the last 7 days from the database
const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(today.getDate() - 6); // Adjust for correct range

const week = await Points.find({
  user: req.user.id,
  date: { $gte: sevenDaysAgo }
})
  .select('-_id -__v -user')
  .sort('date');

// Normalize the dates and store in a Map
const weekMap = new Map();
week.forEach((day) => {
  const normalizedDate = new Date(day.date);
  normalizedDate.setHours(0, 0, 0, 0); // Ensure the same format
  weekMap.set(normalizedDate.getTime(), day.points); // Use timestamp as key
});

// Build the array with missing days filled with 0 points
const weekArray = [];
for (let i = 6; i >= 0; i--) { // Reverse loop for correct order
  const day = new Date(today);
  day.setDate(today.getDate() - i);
  day.setHours(0, 0, 0, 0); // Normalize

  weekArray.push({
    date: day,
    points: weekMap.get(day.getTime()) || 0, // Fetch from map
  });
}

res.status(200).json({
  status: 'success',
  data: {
    week: weekArray
  }
});


});

// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);