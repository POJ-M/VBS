const Sequence = require('../models/Sequence');
const Student = require('../models/Student');

const { GRADE_TO_CATEGORY, CATEGORY_CODE } = Student;

/**
 * Generates a unique Student ID atomically.
 * Format: YY + CategoryCode + 3-digit sequence (e.g., 26BEG001)
 *
 * @param {string} grade - Student's grade
 * @param {number} vbsYear - Current VBS year (e.g., 2026)
 * @returns {Promise<string>} Generated Student ID
 */
const generateStudentId = async (grade, vbsYear) => {
  const category = GRADE_TO_CATEGORY[grade];
  if (!category) throw new Error(`Invalid grade: ${grade}`);

  const categoryCode = CATEGORY_CODE[category];
  const yy = String(vbsYear).slice(-2); // Last 2 digits: 2026 → '26'
  const key = `${yy}${categoryCode}`; // e.g., '26BEG'

  // Atomic increment using findByIdAndUpdate with upsert
  const sequence = await Sequence.getNextSequence(key);
  const paddedSeq = String(sequence).padStart(3, '0'); // e.g., 001, 045, 150

  return `${yy}${categoryCode}${paddedSeq}`; // e.g., 26BEG001
};

/**
 * Initializes sequence counter from existing data (for data migration).
 */
const syncSequenceCounters = async (vbsYear) => {
  const Student = require('../models/Student');
  const yy = String(vbsYear).slice(-2);
  const categories = ['BEG', 'PRI', 'JUN', 'INT'];

  for (const code of categories) {
    const prefix = `${yy}${code}`;
    const students = await Student.find({
      studentId: { $regex: `^${prefix}` },
      vbsYear,
    }).sort({ studentId: -1 });

    if (students.length > 0) {
      const lastId = students[0].studentId;
      const lastSeq = parseInt(lastId.replace(prefix, ''), 10);
      await Sequence.findByIdAndUpdate(
        prefix,
        { seq: lastSeq },
        { upsert: true }
      );
    }
  }
};

module.exports = { generateStudentId, syncSequenceCounters };
