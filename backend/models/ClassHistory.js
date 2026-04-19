// backend/models/ClassHistory.js
const classHistorySchema = new mongoose.Schema({
  student:       { type: ObjectId, ref: 'Student', required: true },
  fromClass:     { type: ObjectId, ref: 'Class' },   // null = first assignment
  toClass:       { type: ObjectId, ref: 'Class' },   // null = unassigned
  reassignedAt:  { type: Date, default: Date.now },
  reassignedBy:  { type: ObjectId, ref: 'User' },
  reason:        { type: String, trim: true },
  effectiveDate: { type: Date, default: Date.now },  // which day the move takes effect
}, { timestamps: true });

classHistorySchema.index({ student: 1, reassignedAt: -1 });
classHistorySchema.index({ fromClass: 1 });
classHistorySchema.index({ toClass: 1 });
