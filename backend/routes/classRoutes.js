import express from 'express';
import {
  createClass,
  updateClass,
  getFacultyClasses,
  joinClass,
  leaveClass,
  getStudentClasses,
  getClassById,
  deleteClass,
  getClassStudents,
  removeStudentFromClass,
  addAnnouncement,
  deleteAnnouncement,
} from '../controllers/classController.js';
import { protect, faculty } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', faculty, createClass);
router.get('/faculty', faculty, getFacultyClasses);
router.post('/join', joinClass);
router.get('/student', getStudentClasses);
router.get('/:id', getClassById);
router.put('/:id', faculty, updateClass);
router.delete('/:id', faculty, deleteClass);
router.post('/:id/leave', leaveClass);
router.get('/:id/students', faculty, getClassStudents);
router.delete('/:id/students/:studentId', faculty, removeStudentFromClass);
router.post('/:id/announcements', faculty, addAnnouncement);
router.delete('/:id/announcements/:announcementId', faculty, deleteAnnouncement);

export default router;
