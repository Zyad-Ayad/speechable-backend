const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  points : {
    type: Number,
    default: 0
  },
  sections: {
    type: [
      {
        lastTimeUsed: { type: Date, default: null },
        correctAttempts: { type: Number, default: 0 },
        wrongAttempts: { type: Number, default: 0 }
      }
    ],
    default: Array(10).fill().map(() => ({
      lastTimeUsed: null,
      correctAttempts: 0,
      wrongAttempts: 0
    }))
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE and SAVE!!!
      validator: function(el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!'
    }
  },
  passwordChangedAt: Date,
  passwordResetPIN: String,
  passwordResetExpires: Date,
  passwordResetPINAttempts: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true,
    select: false
  }
});

userSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function(next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.correctPassword = async function(
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

userSchema.methods.createPasswordResetPIN = function() {
  const resetPIN = Math.random().toString().slice(2, 6);

  this.passwordResetPIN = crypto
    .createHash('sha256')
    .update(resetPIN)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  this.passwordResetPINAttempts = 0;

  return resetPIN;
};

const User = mongoose.model('User', userSchema);

module.exports = User;