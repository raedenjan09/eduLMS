import mongoose from 'mongoose';

const slideSchema = new mongoose.Schema({
  slideNumber: {
    type: Number,
    required: true,
    default: 1,
  },
  title: {
    type: String,
    default: 'Slide',
    trim: true,
  },
  content: {
    type: String,
    default: '',
  },
  bullets: [
    {
      type: String,
    },
  ],
  imageUrl: {
    type: String,
    default: '',
  },
});

const attachmentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  publicId: {
    type: String,
    default: '',
  },
  resourceType: {
    type: String,
    default: '',
  },
});

const lessonSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  order: {
    type: Number,
    required: true,
    default: 1,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  presentationType: {
    type: String,
    enum: ['upload', 'create'],
    default: 'upload',
  },
  content: {
    type: String,
    default: '',
  },
  slides: [slideSchema],
  attachments: [attachmentSchema],
  summary: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Lesson = mongoose.model('Lesson', lessonSchema);

export default Lesson;

