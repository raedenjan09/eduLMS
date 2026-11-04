import User from '../models/User.js';
import Class from '../models/Class.js';
import Lesson from '../models/Lesson.js';
import Quiz from '../models/Quiz.js';
import Progress from '../models/Progress.js';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { destroyCloudinaryAsset } from '../config/cloudinary.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Validation rules for registration
export const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['student', 'faculty']).withMessage('Role must be either student or faculty'),
  body('termsAccepted')
    .custom((value) => value === true || value === 'true')
    .withMessage('You must agree to the Privacy Terms & Conditions to register'),
];

// Validation rules for login
export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: errors.array()[0].msg,
      errors: errors.array() 
    });
  }

  const { name, email, password, role, termsAccepted } = req.body;

  try {
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role === 'faculty' ? 'faculty' : 'student',
      termsAccepted: Boolean(termsAccepted),
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || '',
        termsAccepted: user.termsAccepted,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration. Please try again later.' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: errors.array()[0].msg,
      errors: errors.array() 
    });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || '',
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login. Please try again later.' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || '',
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// @desc    Update user profile (name, profilePicture, optional password)
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, profilePicture, currentPassword, newPassword } = req.body;

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (profilePicture !== undefined) {
      if (user.profilePicture && user.profilePicture !== profilePicture.trim()) {
        await destroyCloudinaryAsset(user.profilePicture);
      }
      user.profilePicture = profilePicture.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Please enter your current password to set a new password.' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
      }
      user.password = newPassword;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture || '',
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
};

// @desc    Upload user avatar image to Cloudinary
// @route   POST /api/auth/profile/avatar
// @access  Private
export const uploadUserAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided.' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const avatarUrl = req.file.path || req.file.secure_url;
    if (user.profilePicture && user.profilePicture !== avatarUrl) {
      await destroyCloudinaryAsset(user.profilePicture);
    }

    user.profilePicture = avatarUrl;
    await user.save();

    res.json({
      profilePicture: avatarUrl,
      message: 'Profile picture uploaded successfully.',
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Failed to upload profile picture.' });
  }
};

// @desc    Get system overview stats, users, and classes for Admin Dashboard
// @route   GET /api/auth/admin/overview
// @access  Private (Admin)
export const getAdminOverview = async (req, res) => {
  try {
    const [users, classes, lessonCounts, totalQuizzes] = await Promise.all([
      User.find().select('-password').sort({ createdAt: -1 }),
      Class.find().populate('faculty', 'name email').sort({ createdAt: -1 }),
      Lesson.aggregate([
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
      Quiz.countDocuments(),
    ]);

    const lessonCountMap = new Map();
    let totalLessons = 0;
    lessonCounts.forEach((item) => {
      lessonCountMap.set(item._id.toString(), item.count);
      totalLessons += item.count;
    });

    const enrichedClasses = classes.map((cls) => ({
      ...cls.toObject(),
      studentCount: cls.students?.length || 0,
      lessonCount: lessonCountMap.get(cls._id.toString()) || 0,
    }));

    const totalStudents = users.filter((u) => u.role === 'student').length;
    const totalFaculty = users.filter((u) => u.role === 'faculty').length;
    const totalAdmins = users.filter((u) => u.role === 'admin').length;

    res.json({
      stats: {
        totalUsers: users.length,
        totalStudents,
        totalFaculty,
        totalAdmins,
        totalClasses: classes.length,
        totalLessons,
        totalQuizzes,
      },
      users,
      classes: enrichedClasses,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ message: 'Failed to load admin overview.' });
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/admin/users/:id/role
// @access  Private (Admin)
export const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['student', 'faculty', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: `User role updated to ${role}.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role.' });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/admin/users/:id
// @access  Private (Admin)
export const deleteUserAdmin = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Remove student from any classes and delete their progress
    await Class.updateMany({ students: user._id }, { $pull: { students: user._id } });
    await Progress.deleteMany({ studentId: user._id });
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
};
