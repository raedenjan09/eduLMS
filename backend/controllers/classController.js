import crypto from 'crypto';
import Class from '../models/Class.js';
import Lesson from '../models/Lesson.js';
import Quiz from '../models/Quiz.js';
import Progress from '../models/Progress.js';
import { destroyCloudinaryAssets } from '../config/cloudinary.js';
import { extractSurnameAndFormat } from './reportController.js';

// Helper to generate a clean 6-character alphanumeric code
const generateClassCode = async () => {
  let isUnique = false;
  let code = '';
  while (!isUnique) {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const existing = await Class.findOne({ classCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private (Faculty/Admin)
export const createClass = async (req, res) => {
  const { subjectCode, name, term, year, description } = req.body;

  if (!subjectCode || !name || !term || !year) {
    return res.status(400).json({ 
      message: 'Please provide subject code, class name, term/semester, and academic year.' 
    });
  }

  try {
    const classCode = await generateClassCode();

    const newClass = await Class.create({
      subjectCode: subjectCode.trim().toUpperCase(),
      name: name.trim(),
      term: term.trim(),
      year: year.trim(),
      description: description ? description.trim() : '',
      classCode,
      faculty: req.user._id,
      students: [],
      announcements: [],
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ message: 'Failed to create class.' });
  }
};

// @desc    Update class details (subjectCode, name, term, year, description)
// @route   PUT /api/classes/:id
// @access  Private (Faculty/Admin)
export const updateClass = async (req, res) => {
  const { subjectCode, name, term, year, description } = req.body;

  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this class.' });
    }

    if (subjectCode && subjectCode.trim()) cls.subjectCode = subjectCode.trim().toUpperCase();
    if (name && name.trim()) cls.name = name.trim();
    if (term && term.trim()) cls.term = term.trim();
    if (year && year.trim()) cls.year = year.trim();
    if (description !== undefined) cls.description = description.trim();

    await cls.save();
    res.json(cls);
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ message: 'Failed to update class.' });
  }
};

// @desc    Get all classes created by logged-in faculty (single-query aggregation, no N+1)
// @route   GET /api/classes/faculty
// @access  Private (Faculty)
export const getFacultyClasses = async (req, res) => {
  try {
    const classes = await Class.find({ faculty: req.user._id })
      .populate('faculty', 'name email')
      .sort({ createdAt: -1 });

    if (classes.length === 0) {
      return res.json([]);
    }

    const classIds = classes.map((c) => c._id);
    const lessonCounts = await Lesson.aggregate([
      { $match: { classId: { $in: classIds } } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]);

    const lessonCountMap = new Map(
      lessonCounts.map((item) => [item._id.toString(), item.count])
    );

    const enriched = classes.map((cls) => ({
      ...cls.toObject(),
      studentCount: cls.students?.length || 0,
      lessonCount: lessonCountMap.get(cls._id.toString()) || 0,
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Get faculty classes error:', error);
    res.status(500).json({ message: 'Failed to fetch faculty classes.' });
  }
};

// @desc    Join a class using class code
// @route   POST /api/classes/join
// @access  Private (Student)
export const joinClass = async (req, res) => {
  const { classCode } = req.body;

  if (!classCode) {
    return res.status(400).json({ message: 'Please enter a valid class code.' });
  }

  try {
    const cleanCode = classCode.trim().toUpperCase();
    const foundClass = await Class.findOne({ classCode: cleanCode })
      .populate('faculty', 'name email');

    if (!foundClass) {
      return res.status(404).json({ message: 'No class found with this code. Please verify and try again.' });
    }

    // Check if student is already enrolled
    const isEnrolled = foundClass.students.some(
      (sId) => sId.toString() === req.user._id.toString()
    );

    if (isEnrolled) {
      return res.status(400).json({ message: 'You are already enrolled in this class.' });
    }

    foundClass.students.push(req.user._id);
    await foundClass.save();

    res.json({
      message: `Successfully joined ${foundClass.name}!`,
      classData: foundClass,
    });
  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({ message: 'Failed to join class.' });
  }
};

// @desc    Student leaves / unenrolls from a class
// @route   POST /api/classes/:id/leave
// @access  Private (Student)
export const leaveClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const isEnrolled = cls.students.some(
      (sId) => sId.toString() === req.user._id.toString()
    );

    if (!isEnrolled) {
      return res.status(400).json({ message: 'You are not enrolled in this class.' });
    }

    cls.students = cls.students.filter(
      (sId) => sId.toString() !== req.user._id.toString()
    );
    await cls.save();

    await Progress.deleteMany({ classId: cls._id, studentId: req.user._id });

    res.json({ message: `You have unenrolled from ${cls.name}.` });
  } catch (error) {
    console.error('Leave class error:', error);
    res.status(500).json({ message: 'Failed to unenroll from class.' });
  }
};

// @desc    Get all enrolled classes for logged-in student (batch aggregation, no N+1)
// @route   GET /api/classes/student
// @access  Private (Student)
export const getStudentClasses = async (req, res) => {
  try {
    const classes = await Class.find({ students: req.user._id })
      .populate('faculty', 'name email')
      .sort({ createdAt: -1 });

    if (classes.length === 0) {
      return res.json([]);
    }

    const classIds = classes.map((c) => c._id);

    const [lessonCounts, progressCounts] = await Promise.all([
      Lesson.aggregate([
        { $match: { classId: { $in: classIds } } },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
      Progress.aggregate([
        {
          $match: {
            studentId: req.user._id,
            classId: { $in: classIds },
            passed: true,
          },
        },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
    ]);

    const lessonCountMap = new Map(
      lessonCounts.map((item) => [item._id.toString(), item.count])
    );
    const progressCountMap = new Map(
      progressCounts.map((item) => [item._id.toString(), item.count])
    );

    const enriched = classes.map((cls) => {
      const lessonCount = lessonCountMap.get(cls._id.toString()) || 0;
      const progressCount = Math.min(
        progressCountMap.get(cls._id.toString()) || 0,
        lessonCount
      );
      const progressPercent =
        lessonCount > 0 ? Math.round((progressCount / lessonCount) * 100) : 0;

      return {
        ...cls.toObject(),
        lessonCount,
        completedLessons: progressCount,
        progressPercent,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({ message: 'Failed to fetch enrolled classes.' });
  }
};

// @desc    Get single class details with member and lesson info
// @route   GET /api/classes/:id
// @access  Private
export const getClassById = async (req, res) => {
  try {
    const foundClass = await Class.findById(req.params.id)
      .populate('faculty', 'name email')
      .populate('students', 'name email profilePicture createdAt');

    if (!foundClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Check authorization: must be the faculty or an enrolled student or an admin
    const isFaculty = foundClass.faculty._id.toString() === req.user._id.toString();
    const isStudent = foundClass.students.some(
      (s) => s._id.toString() === req.user._id.toString()
    );
    const isAdmin = req.user.role === 'admin';

    if (!isFaculty && !isStudent && !isAdmin) {
      return res.status(403).json({ message: 'You are not enrolled in or managing this class.' });
    }

    const lessons = await Lesson.find({ classId: foundClass._id }).sort({ order: 1 });

    res.json({
      ...foundClass.toObject(),
      lessons,
      isFacultyOwner: isFaculty,
    });
  } catch (error) {
    console.error('Get class by ID error:', error);
    res.status(500).json({ message: 'Failed to load class details.' });
  }
};

// @desc    Delete class (including lessons, quizzes, progress, and Cloudinary files)
// @route   DELETE /api/classes/:id
// @access  Private (Faculty/Admin)
export const deleteClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this class.' });
    }

    // Clean up any Cloudinary attachments belonging to lessons in this class
    const lessons = await Lesson.find({ classId: cls._id }).select('attachments');
    const allAttachments = lessons.flatMap((l) => l.attachments || []);
    if (allAttachments.length > 0) {
      await destroyCloudinaryAssets(allAttachments);
    }

    await Promise.all([
      Lesson.deleteMany({ classId: cls._id }),
      Quiz.deleteMany({ classId: cls._id }),
      Progress.deleteMany({ classId: cls._id }),
      Class.findByIdAndDelete(cls._id),
    ]);

    res.json({ message: 'Class, lessons, quizzes, and student progress deleted successfully.' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ message: 'Failed to delete class.' });
  }
};

// @desc    Post a new class announcement
// @route   POST /api/classes/:id/announcements
// @access  Private (Faculty/Admin)
export const addAnnouncement = async (req, res) => {
  const { title, content, dueDate } = req.body;

  if (!title || !title.trim() || !content || !content.trim()) {
    return res.status(400).json({ message: 'Announcement title and content are required.' });
  }

  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to post announcements in this class.' });
    }

    cls.announcements.unshift({
      title: title.trim(),
      content: content.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
    });

    await cls.save();
    res.status(201).json({
      message: 'Announcement posted.',
      announcements: cls.announcements,
    });
  } catch (error) {
    console.error('Add announcement error:', error);
    res.status(500).json({ message: 'Failed to post announcement.' });
  }
};

// @desc    Delete a class announcement
// @route   DELETE /api/classes/:id/announcements/:announcementId
// @access  Private (Faculty/Admin)
export const deleteAnnouncement = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete announcements in this class.' });
    }

    cls.announcements = cls.announcements.filter(
      (a) => a._id.toString() !== req.params.announcementId
    );
    await cls.save();

    res.json({
      message: 'Announcement deleted.',
      announcements: cls.announcements,
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ message: 'Failed to delete announcement.' });
  }
};

// @desc    Get enrolled students in a class with progress overview
// @route   GET /api/classes/:id/students
// @access  Private (Faculty/Admin)
export const getClassStudents = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('faculty', 'name email')
      .populate('students', 'name email profilePicture createdAt');

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view students for this class.' });
    }

    const lessons = await Lesson.find({ classId: cls._id }).sort({ order: 1 });
    const allProgresses = await Progress.find({ classId: cls._id });

    const progressMap = new Map();
    allProgresses.forEach((p) => {
      progressMap.set(`${p.studentId.toString()}-${p.lessonId.toString()}`, p);
    });

    const studentsWithProgress = cls.students.map((student) => {
      let completedLessonsCount = 0;
      let totalScore = 0;
      let quizCount = 0;
      let totalAttempts = 0;
      let hasStarted = false;

      const lessonBreakdown = lessons.map((lesson) => {
        const prog = progressMap.get(`${student._id.toString()}-${lesson._id.toString()}`);
        const passed = prog?.passed || false;
        const highestScore = prog?.highestScore || 0;
        const attempts = prog?.quizAttempts?.length || 0;
        const slidesViewed = prog?.slidesViewed || false;

        if (slidesViewed || attempts > 0 || passed) {
          hasStarted = true;
        }

        if (passed) {
          completedLessonsCount += 1;
        }
        if (attempts > 0) {
          totalScore += highestScore;
          quizCount += 1;
          totalAttempts += attempts;
        }

        return {
          lessonId: lesson._id,
          order: lesson.order,
          title: lesson.title,
          passed,
          highestScore,
          attempts,
          slidesViewed,
        };
      });

      const averageScore = quizCount > 0 ? Math.round(totalScore / quizCount) : 0;
      const totalLessons = lessons.length;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;
      const isCompleted = totalLessons > 0 && completedLessonsCount === totalLessons;
      const { surname, firstName, formattedName } = extractSurnameAndFormat(student.name);

      return {
        _id: student._id,
        name: student.name,
        surname,
        firstName,
        formattedName,
        email: student.email,
        profilePicture: student.profilePicture || '',
        joinedAt: student.createdAt,
        completedLessonsCount,
        totalLessons,
        progressPercent,
        averageScore,
        quizCount,
        totalAttempts,
        isCompleted,
        status: isCompleted
          ? 'Completed'
          : hasStarted
            ? 'In Progress'
            : 'Not Started',
        lessons: lessonBreakdown,
      };
    });

    studentsWithProgress.sort((a, b) => {
      const surnameDiff = a.surname.localeCompare(b.surname, undefined, { sensitivity: 'base' });
      if (surnameDiff !== 0) return surnameDiff;
      return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' });
    });

    res.json({
      classId: cls._id,
      className: cls.name,
      subjectCode: cls.subjectCode,
      classCode: cls.classCode,
      totalStudents: studentsWithProgress.length,
      totalLessons: lessons.length,
      students: studentsWithProgress,
    });
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ message: 'Failed to fetch enrolled students.' });
  }
};

// @desc    Remove an enrolled student from a class
// @route   DELETE /api/classes/:id/students/:studentId
// @access  Private (Faculty/Admin)
export const removeStudentFromClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to manage students in this class.' });
    }

    const { studentId } = req.params;
    const initialCount = cls.students.length;
    cls.students = cls.students.filter((sId) => sId.toString() !== studentId.toString());

    if (cls.students.length === initialCount) {
      return res.status(404).json({ message: 'Student is not enrolled in this class.' });
    }

    await cls.save();

    // Clean up student progress for this class
    await Progress.deleteMany({ classId: cls._id, studentId });

    res.json({ message: 'Student removed successfully from class.' });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({ message: 'Failed to remove student from class.' });
  }
};
