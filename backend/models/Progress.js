import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema({
  score: {
    type: Number, // Percentage: 0 - 100
    required: true,
  },
  rawScore: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  passed: {
    type: Boolean,
    required: true,
  },
  answers: [
    {
      questionIndex: Number,
      selectedAnswer: Number,
      isCorrect: Boolean,
    },
  ],
  attemptDate: {
    type: Date,
    default: Date.now,
  },
});

const progressSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
  },
  slidesViewed: {
    type: Boolean,
    default: false,
  },
  quizAttempts: [attemptSchema],
  highestScore: {
    type: Number,
    default: 0,
  },
  latestScore: {
    type: Number,
    default: 0,
  },
  passed: {
    type: Boolean,
    default: false, // true once student gets >= 75%
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure a student has only one progress document per lesson
progressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);

export default Progress;

