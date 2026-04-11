const mongoose = require('mongoose');

// Used for atomic sequence generation to prevent race conditions
const sequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "26BEG"
  seq: { type: Number, default: 0 },
});

sequenceSchema.statics.getNextSequence = async function (yearCategory) {
  const result = await this.findByIdAndUpdate(
    yearCategory,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
};

module.exports = mongoose.model('Sequence', sequenceSchema);
