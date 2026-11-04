import express from 'express';
import {
  saveQuiz,
  bulkParseQuestions,
  getQuizByIdOrLesson,
  submitQuizAttempt,
} from '../controllers/quizController.js';
import { protect, faculty } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', faculty, saveQuiz);
router.post('/bulk-parse', faculty, bulkParseQuestions);
router.get('/lesson/:lessonId', getQuizByIdOrLesson);
router.get('/:id', getQuizByIdOrLesson);
router.post('/:id/submit', submitQuizAttempt);

export default router;
