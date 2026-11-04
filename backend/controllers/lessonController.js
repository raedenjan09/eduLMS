import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Lesson from '../models/Lesson.js';
import Class from '../models/Class.js';
import Quiz from '../models/Quiz.js';
import Progress from '../models/Progress.js';
import { cloudinary, destroyCloudinaryAssets, parseCloudinaryUrl } from '../config/cloudinary.js';

const execFileAsync = promisify(execFile);

// Convert a .ppt/.pptx Buffer to a cached .pdf Buffer using Windows PowerPoint COM (if available)
const convertPptBufferToPdf = async (pptBuffer, cacheKey, ext = '.pptx') => {
  const safeKey = String(cacheKey).replace(/[^a-zA-Z0-9_-]/g, '_');
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `lms_slide_${safeKey}${ext}`);
  const outPath = path.join(tmpDir, `lms_slide_${safeKey}.pdf`);

  try {
    const existing = await fs.readFile(outPath);
    if (existing && existing.length > 100) return existing;
  } catch {
    // Not cached yet
  }

  await fs.writeFile(inPath, pptBuffer);

  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'Stop'
      $ppt = New-Object -ComObject PowerPoint.Application
      $pres = $ppt.Presentations.Open('${inPath.replace(/'/g, "''")}', -1, 0, 0)
      $pres.SaveAs('${outPath.replace(/'/g, "''")}', 32)
      $pres.Close()
    `;
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      timeout: 25000,
    });
    const pdfBuf = await fs.readFile(outPath);
    if (pdfBuf && pdfBuf.length > 100) return pdfBuf;
  }

  return null;
};

// Helper to normalize lesson order numbers (1..N) sequentially for a class
const normalizeClassLessonOrders = async (classId) => {
  const remaining = await Lesson.find({ classId }).sort({ order: 1, createdAt: 1 });
  const bulkOps = [];
  remaining.forEach((l, idx) => {
    const expectedOrder = idx + 1;
    if (l.order !== expectedOrder) {
      bulkOps.push({
        updateOne: {
          filter: { _id: l._id },
          update: { $set: { order: expectedOrder } },
        },
      });
    }
  });
  if (bulkOps.length > 0) {
    await Lesson.bulkWrite(bulkOps);
  }
};

// @desc    Upload file attachment for lesson
// @route   POST /api/lessons/upload
// @access  Private (Faculty)
export const uploadAttachment = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file was uploaded.' });
  }

  const fileUrl = req.file.path || req.file.secure_url;
  const parsed = parseCloudinaryUrl(fileUrl);

  res.json({
    fileName: req.file.originalname,
    fileUrl,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    publicId: req.file.filename || parsed?.publicId || '',
    resourceType: parsed?.resourceType || '',
  });
};

// @desc    Download lesson attachment with forced content-disposition and proper filename
// @route   GET /api/lessons/:id/attachment/:index/download
// @access  Private
export const downloadAttachment = async (req, res) => {
  try {
    const { id, index } = req.params;
    const lesson = await Lesson.findById(id);

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    const attachmentIndex = parseInt(index, 10);
    const attachment = lesson.attachments?.[attachmentIndex];

    if (!attachment || !attachment.fileUrl) {
      return res.status(404).json({ message: 'Attachment not found.' });
    }

    let fileResponse = await fetch(attachment.fileUrl);

    // Fallback: if Cloudinary blocks unsigned PDF/raw delivery, try a signed Cloudinary URL
    if (!fileResponse.ok) {
      const parsed = parseCloudinaryUrl(attachment.fileUrl);
      const publicId = attachment.publicId || parsed?.publicId;
      const resourceType = attachment.resourceType || parsed?.resourceType || 'image';

      if (publicId) {
        const extMatch = (attachment.fileName || attachment.fileUrl || '').match(/\.([a-zA-Z0-9]+)$/);
        const format = extMatch ? extMatch[1].toLowerCase() : 'pdf';

        const signedUrl = cloudinary.url(publicId, {
          resource_type: resourceType,
          type: 'upload',
          sign_url: true,
          secure: true,
          ...(resourceType !== 'raw' ? { format } : {}),
        });
        fileResponse = await fetch(signedUrl);

        if (!fileResponse.ok && resourceType !== 'raw') {
          const privateDownloadUrl = cloudinary.utils.private_download_url(publicId, format, {
            resource_type: resourceType,
            type: 'upload',
          });
          fileResponse = await fetch(privateDownloadUrl);
        }
      }
    }

    if (!fileResponse.ok) {
      console.error('Cloudinary download fetch failed:', fileResponse.status, fileResponse.statusText);
      return res.status(fileResponse.status).json({
        message: 'Unable to retrieve file from storage. If this is a raw document or PDF, check Cloudinary restricted delivery settings.',
      });
    }

    const isPdfFile =
      attachment.fileType === 'application/pdf' ||
      /\.pdf$/i.test(attachment.fileName || '') ||
      /\.pdf(\?|$)/i.test(attachment.fileUrl || '');

    const contentType = isPdfFile
      ? 'application/pdf'
      : attachment.fileType || fileResponse.headers.get('content-type') || 'application/octet-stream';
    const cleanFileName = attachment.fileName || 'download';
    const dispositionType = req.query.inline === 'true' ? 'inline' : 'attachment';

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isPptFile = /\.(ppt|pptx)$/i.test(attachment.fileName || attachment.fileUrl || '');
    if (req.query.asPdf === 'true' && isPptFile) {
      try {
        const ext = /\.ppt$/i.test(attachment.fileName || '') ? '.ppt' : '.pptx';
        const cacheKey = `${lesson._id}_${attachment.publicId || attachment.fileName || index}`;
        const convertedPdf = await convertPptBufferToPdf(buffer, cacheKey, ext);
        if (convertedPdf) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cleanFileName.replace(/\.(ppt|pptx)$/i, '.pdf'))}"`);
          return res.send(convertedPdf);
        }
      } catch (convErr) {
        console.warn('PPT to PDF conversion fallback to raw buffer:', convErr.message);
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(cleanFileName)}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ message: 'Failed to download attachment.' });
  }
};

// @desc    Create a new lesson in a class
// @route   POST /api/lessons
// @access  Private (Faculty)
export const createLesson = async (req, res) => {
  const { classId, title, presentationType, content, slides, attachments, summary } = req.body;

  if (!classId || !title) {
    return res.status(400).json({ message: 'Class ID and Lesson title are required.' });
  }

  try {
    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to add lessons to this class.' });
    }

    // Determine the next order number safely
    const lastLesson = await Lesson.findOne({ classId }).sort({ order: -1 });
    const order = lastLesson && typeof lastLesson.order === 'number' ? lastLesson.order + 1 : 1;

    const cleanSlides = Array.isArray(slides)
      ? slides
          .filter((s) => s && (s.title?.trim() || s.content?.trim() || s.imageUrl?.trim() || (Array.isArray(s.bullets) && s.bullets.some((b) => b?.trim()))))
          .map((s, idx) => ({
            slideNumber: idx + 1,
            title: s.title?.trim() || `Slide ${idx + 1}`,
            content: s.content || '',
            bullets: Array.isArray(s.bullets) ? s.bullets : [],
            imageUrl: s.imageUrl || '',
          }))
      : [];

    const cleanAttachments = Array.isArray(attachments) ? attachments.slice(0, 1) : [];
    const resolvedType =
      presentationType === 'create' || (presentationType !== 'upload' && cleanSlides.length > 0 && cleanAttachments.length === 0)
        ? 'create'
        : 'upload';

    // If faculty chose 'create', clean up any uploaded files that were not used
    if (resolvedType === 'create' && Array.isArray(attachments) && attachments.length > 0) {
      await destroyCloudinaryAssets(attachments);
    }

    const lesson = await Lesson.create({
      classId,
      order,
      title: title.trim(),
      presentationType: resolvedType,
      content: content || '',
      slides: resolvedType === 'create' ? cleanSlides : [],
      attachments: resolvedType === 'upload' ? cleanAttachments : [],
      summary: summary || '',
    });

    await normalizeClassLessonOrders(classId);

    res.status(201).json(lesson);
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ message: 'Failed to create lesson.' });
  }
};

// @desc    Update a lesson (and clean up removed Cloudinary files)
// @route   PUT /api/lessons/:id
// @access  Private (Faculty)
export const updateLesson = async (req, res) => {
  const { title, presentationType, content, slides, attachments, summary } = req.body;

  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    const cls = await Class.findById(lesson.classId);
    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this lesson.' });
    }

    const resolvedType =
      presentationType === 'create' || presentationType === 'upload'
        ? presentationType
        : lesson.presentationType || (lesson.slides?.length > 0 && !lesson.attachments?.length ? 'create' : 'upload');

    lesson.presentationType = resolvedType;

    if (resolvedType === 'create') {
      // Switched to created slides: remove any existing uploaded presentation files from Cloudinary
      const filesToClean = [...(lesson.attachments || []), ...(Array.isArray(attachments) ? attachments : [])];
      if (filesToClean.length > 0) {
        await destroyCloudinaryAssets(filesToClean);
      }
      lesson.attachments = [];

      if (slides !== undefined && Array.isArray(slides)) {
        lesson.slides = slides
          .filter((s) => s && (s.title?.trim() || s.content?.trim() || s.imageUrl?.trim() || (Array.isArray(s.bullets) && s.bullets.some((b) => b?.trim()))))
          .map((s, idx) => ({
            slideNumber: idx + 1,
            title: s.title?.trim() || `Slide ${idx + 1}`,
            content: s.content || '',
            bullets: Array.isArray(s.bullets) ? s.bullets : [],
            imageUrl: s.imageUrl || '',
          }));
      }
    } else {
      // 'upload' presentation mode: clear built-in slides and keep only the single uploaded presentation
      lesson.slides = [];

      if (attachments !== undefined && Array.isArray(attachments)) {
        const singleUpload = attachments.slice(0, 1);
        const keptUrls = new Set(singleUpload.map((a) => a.fileUrl));
        const removedAttachments = (lesson.attachments || []).filter(
          (oldAtt) => oldAtt?.fileUrl && !keptUrls.has(oldAtt.fileUrl)
        );
        if (removedAttachments.length > 0) {
          await destroyCloudinaryAssets(removedAttachments);
        }
        lesson.attachments = singleUpload;
      }
    }

    if (title) lesson.title = title.trim();
    if (content !== undefined) lesson.content = content;
    if (summary !== undefined) lesson.summary = summary;

    await lesson.save();
    res.json(lesson);
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ message: 'Failed to update lesson.' });
  }
};

// @desc    Delete a lesson (cleans up Cloudinary files and renumbers remaining lessons)
// @route   DELETE /api/lessons/:id
// @access  Private (Faculty)
export const deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    const cls = await Class.findById(lesson.classId);
    if (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this lesson.' });
    }

    const classId = lesson.classId;

    // Clean up Cloudinary attachments
    if (lesson.attachments && lesson.attachments.length > 0) {
      await destroyCloudinaryAssets(lesson.attachments);
    }

    await Promise.all([
      Quiz.deleteMany({ lessonId: lesson._id }),
      Progress.deleteMany({ lessonId: lesson._id }),
      Lesson.findByIdAndDelete(lesson._id),
    ]);

    // Auto-renumber all remaining lessons in the class to 1..N without gaps
    await normalizeClassLessonOrders(classId);

    res.json({ message: 'Lesson and associated files deleted successfully.' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ message: 'Failed to delete lesson.' });
  }
};

// @desc    Move a lesson up or down in the syllabus order
// @route   PUT /api/lessons/:id/reorder
// @access  Private (Faculty)
export const reorderLesson = async (req, res) => {
  const { direction } = req.body; // 'up' | 'down'

  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ message: 'Direction must be "up" or "down".' });
  }

  try {
    const targetLesson = await Lesson.findById(req.params.id);
    if (!targetLesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    const cls = await Class.findById(targetLesson.classId);
    if (!cls || (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Not authorized to reorder lessons for this class.' });
    }

    // Fetch all lessons in order and normalize first
    const lessons = await Lesson.find({ classId: targetLesson.classId }).sort({ order: 1, createdAt: 1 });
    const currentIndex = lessons.findIndex((l) => l._id.toString() === targetLesson._id.toString());

    if (currentIndex === -1) {
      return res.status(404).json({ message: 'Lesson not found in class.' });
    }

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= lessons.length) {
      return res.status(400).json({ message: `Cannot move lesson further ${direction}.` });
    }

    // Swap positions in array and write back normalized 1..N orders
    const temp = lessons[currentIndex];
    lessons[currentIndex] = lessons[swapIndex];
    lessons[swapIndex] = temp;

    const bulkOps = lessons.map((l, idx) => ({
      updateOne: {
        filter: { _id: l._id },
        update: { $set: { order: idx + 1 } },
      },
    }));

    await Lesson.bulkWrite(bulkOps);

    res.json({ message: 'Lesson order updated.' });
  } catch (error) {
    console.error('Reorder lesson error:', error);
    res.status(500).json({ message: 'Failed to reorder lesson.' });
  }
};

// @desc    Get all lessons for a class with progression lock calculation
// @route   GET /api/lessons/class/:classId
// @access  Private
export const getLessonsByClass = async (req, res) => {
  const { classId } = req.params;

  try {
    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const [lessons, quizzes] = await Promise.all([
      Lesson.find({ classId }).sort({ order: 1 }),
      Quiz.find({ classId }).select('_id lessonId title passingScore timeLimit shuffleQuestions questions'),
    ]);

    const quizMap = new Map();
    quizzes.forEach((q) => {
      quizMap.set(q.lessonId.toString(), q);
    });

    const isFaculty = cls.faculty.toString() === req.user._id.toString() || req.user.role === 'admin';

    // If faculty, return all lessons unlocked with quiz info
    if (isFaculty) {
      const enriched = lessons.map((lesson) => {
        const quiz = quizMap.get(lesson._id.toString());
        return {
          ...lesson.toObject(),
          isLocked: false,
          hasQuiz: !!quiz,
          quizId: quiz?._id || null,
          quizQuestionCount: quiz?.questions?.length || 0,
          quizTimeLimit: quiz?.timeLimit || 0,
        };
      });
      return res.json(enriched);
    }

    // STUDENT PROGRESSION LOGIC
    // Lesson 1 is always unlocked.
    // Lesson N requires Lesson N-1 to have a progress record with passed === true (>= 75%).
    const studentId = req.user._id;
    const progresses = await Progress.find({ classId, studentId });
    const progressMap = new Map();
    progresses.forEach((p) => {
      progressMap.set(p.lessonId.toString(), p);
    });

    const result = [];
    let previousPassed = true; // Lesson 1 condition: initially true

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const prog = progressMap.get(lesson._id.toString());
      const quiz = quizMap.get(lesson._id.toString());

      const isLocked = !previousPassed;
      const prevLessonTitle = i > 0 ? lessons[i - 1].title : '';

      result.push({
        ...lesson.toObject(),
        isLocked,
        lockReason: isLocked
          ? `Locked: You must complete "${prevLessonTitle}" and pass its quiz with at least 75% first.`
          : null,
        hasQuiz: !!quiz,
        quizId: quiz?._id || null,
        quizQuestionCount: quiz?.questions?.length || 0,
        quizTimeLimit: quiz?.timeLimit || 0,
        passingScore: quiz?.passingScore || 75,
        progress: {
          slidesViewed: prog?.slidesViewed || false,
          passed: prog?.passed || false,
          highestScore: prog?.highestScore || 0,
          latestScore: prog?.latestScore || 0,
          attemptsCount: prog?.quizAttempts?.length || 0,
        },
      });

      // Update condition for NEXT lesson:
      // If this lesson has a quiz, it MUST be passed (>= 75%).
      // If this lesson doesn't have a quiz, viewed slides counts as passed.
      if (quiz) {
        previousPassed = prog?.passed === true;
      } else {
        previousPassed = prog?.slidesViewed === true;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Get lessons by class error:', error);
    res.status(500).json({ message: 'Failed to load lessons.' });
  }
};

// @desc    Get single lesson by ID
// @route   GET /api/lessons/:id
// @access  Private
export const getLessonById = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    const cls = await Class.findById(lesson.classId);
    const isFaculty = cls.faculty.toString() === req.user._id.toString() || req.user.role === 'admin';

    // If student, check if locked (all earlier lessons must be passed)
    if (!isFaculty && lesson.order > 1) {
      const priorLessons = await Lesson.find({
        classId: lesson.classId,
        order: { $lt: lesson.order },
      }).sort({ order: 1 });

      const priorIds = priorLessons.map((l) => l._id);
      const priorProgresses = await Progress.find({
        studentId: req.user._id,
        lessonId: { $in: priorIds },
      });
      const passedSet = new Set(
        priorProgresses.filter((p) => p.passed).map((p) => p.lessonId.toString())
      );

      const firstUnpassed = priorLessons.find((l) => !passedSet.has(l._id.toString()));
      if (firstUnpassed) {
        return res.status(403).json({
          isLocked: true,
          message: `Lesson is locked. You must complete "${firstUnpassed.title}" and achieve at least 75% on its quiz first.`,
        });
      }
    }

    const [quiz, progress, nextLesson] = await Promise.all([
      Quiz.findOne({ lessonId: lesson._id }).select('_id title passingScore timeLimit questions'),
      Progress.findOne({
        studentId: req.user._id,
        lessonId: lesson._id,
      }),
      Lesson.findOne({
        classId: lesson.classId,
        order: lesson.order + 1,
      }).select('_id title order'),
    ]);

    res.json({
      ...lesson.toObject(),
      hasQuiz: !!quiz,
      quizId: quiz?._id || null,
      quizQuestionCount: quiz?.questions?.length || 0,
      quizTimeLimit: quiz?.timeLimit || 0,
      progress: progress || null,
      nextLessonId: nextLesson?._id || null,
      nextLessonTitle: nextLesson?.title || null,
    });
  } catch (error) {
    console.error('Get lesson by ID error:', error);
    res.status(500).json({ message: 'Failed to load lesson.' });
  }
};

// @desc    Mark lesson slides/content as viewed by student
// @route   POST /api/lessons/:id/view-slides
// @access  Private (Student)
export const markSlidesViewed = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    let progress = await Progress.findOne({
      studentId: req.user._id,
      lessonId: lesson._id,
    });

    if (!progress) {
      progress = new Progress({
        studentId: req.user._id,
        classId: lesson.classId,
        lessonId: lesson._id,
        slidesViewed: true,
      });
    } else {
      progress.slidesViewed = true;
      progress.updatedAt = new Date();
    }

    // Check if lesson has no quiz; if no quiz, viewing slides marks lesson as passed
    const quiz = await Quiz.findOne({ lessonId: lesson._id });
    if (!quiz) {
      progress.passed = true;
      progress.highestScore = 100;
    }

    await progress.save();
    res.json({ message: 'Slide viewing recorded.', progress });
  } catch (error) {
    console.error('Mark slides viewed error:', error);
    res.status(500).json({ message: 'Failed to record slide progress.' });
  }
};
