import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  getAdminOverview,
  updateUserRole,
  deleteUserAdmin,
  registerValidation, 
  loginValidation 
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { avatarUpload } from '../config/cloudinary.js';

const router = express.Router();

router.post('/register', registerValidation, registerUser);
router.post('/login', loginValidation, loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/profile/avatar', protect, avatarUpload.single('avatar'), uploadUserAvatar);

// Admin routes
router.get('/admin/overview', protect, admin, getAdminOverview);
router.put('/admin/users/:id/role', protect, admin, updateUserRole);
router.delete('/admin/users/:id', protect, admin, deleteUserAdmin);

export default router;
