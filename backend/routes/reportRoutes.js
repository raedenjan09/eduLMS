import express from 'express';
import { getClassReport } from '../controllers/reportController.js';
import { protect, faculty } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/class/:classId', faculty, getClassReport);

export default router;

