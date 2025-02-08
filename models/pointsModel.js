const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema
const PointsSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  points: { type: Number, default: 0 }
});

const Points = mongoose.model('Points', PointsSchema);

module.exports = Points;