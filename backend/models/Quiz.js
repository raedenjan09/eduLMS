import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true,
  },
  options: {
    type: [String],
    validate: {
      validator: function (opts) {
        return Array.isArray(opts) && opts.length >= 2 && opts.length <= 6;
      },
      message: 'A question must have between 2 and 6 options.',
    },
    required: true,
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
  },
  explanation: {
    type: String,
    default: '',
  },
});

const quizSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true,
  },
  passingScore: {
    type: Number,
    default: 75, // 75% passing threshold required
  },
  timeLimit: {
    type: Number,
    default: 0, // 0 = untimed, > 0 = time limit in minutes
  },
  shuffleQuestions: {
    type: Boolean,
    default: true,
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function (qs) {
        return Array.isArray(qs) && qs.length >= 10 && qs.length <= 20;
      },
      message: 'Quiz must contain between 10 (minimum) and 20 (maximum) questions.',
    },
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Quiz = mongoose.model('Quiz', quizSchema);

export default Quiz;

