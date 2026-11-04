import express from 'express';
import {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLesson,
  getLessonsByClass,
  getLessonById,
  markSlidesViewed,
  uploadAttachment,
  downloadAttachment,
} from '../controllers/lessonController.js';
import { protect, faculty } from '../middleware/authMiddleware.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.use(protect);

router.post('/upload', faculty, upload.single('file'), uploadAttachment);
router.post('/', faculty, createLesson);
router.put('/:id/reorder', faculty, reorderLesson);
router.put('/:id', faculty, updateLesson);
router.delete('/:id', faculty, deleteLesson);
router.get('/class/:classId', getLessonsByClass);
router.get('/:id', getLessonById);
router.get('/:id/attachment/:index/download', downloadAttachment);
router.post('/:id/view-slides', markSlidesViewed);

export default router;
