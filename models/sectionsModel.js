const mongoose = require('mongoose');


// section.model.js
const sectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  id: { type: Number, required: true }, // Custom section ID per user
  lastTimeUsed: { type: Date, default: null },
  correctAttempts: { type: Number, default: 0 },
  wrongAttempts: { type: Number, default: 0 }
});

sectionSchema.virtual("totalAttempts").get(function () {
  return this.correctAttempts + this.wrongAttempts;
});
// Optional: ensure sectionId uniqueness per user
sectionSchema.index({ userId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model("Section", sectionSchema);
