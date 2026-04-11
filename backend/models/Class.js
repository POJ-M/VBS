const mongoose = require('mongoose');

const CLASS_GRADE_RANGES = {
  Beginner: ['PreKG', 'LKG', 'UKG', '1', '2'],
  Primary: ['3', '4', '5'],
  Junior: ['6', '7', '8'],
  Inter: ['9', '10', '11', '12'],
};

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      maxlength: [100, 'Class name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      enum: ['Beginner', 'Primary', 'Junior', 'Inter'],
      required: [true, 'Category is required'],
    },
    gradeRange: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 30,
      min: [1, 'Capacity must be at least 1'],
    },
    description: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index: name must be unique per year
classSchema.index({ name: 1, year: 1 }, { unique: true });
classSchema.index({ category: 1, year: 1 });

// Set grade range based on category
classSchema.pre('save', function (next) {
  if (this.isModified('category')) {
    const grades = CLASS_GRADE_RANGES[this.category];
    if (grades) {
      this.gradeRange = `${grades[0]} to ${grades[grades.length - 1]}`;
    }
  }
  next();
});

classSchema.statics.CLASS_GRADE_RANGES = CLASS_GRADE_RANGES;

module.exports = mongoose.model('Class', classSchema);
