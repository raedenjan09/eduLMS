import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import Lesson from '../models/Lesson.js';
import Class from '../models/Class.js';
import Progress from '../models/Progress.js';

// @desc    Create or update quiz for a lesson
// @route   POST /api/quizzes
// @access  Private (Faculty)
export const saveQuiz = async (req, res) => {
  const { classId, lessonId, title, questions, passingScore, timeLimit, shuffleQuestions } = req.body;

  if (!classId || !lessonId || !title) {
    return res.status(400).json({ message: 'Class ID, Lesson ID, and Quiz title are required.' });
  }

  if (!Array.isArray(questions) || questions.length < 10 || questions.length > 20) {
    return res.status(400).json({ 
      message: `A quiz must have between 10 (minimum) and 20 (maximum) questions. Provided: ${questions?.length || 0}.` 
    });
  }

  // Validate questions structure
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.questionText || !q.questionText.trim()) {
      return res.status(400).json({ message: `Question #${i + 1} is missing question text.` });
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return res.status(400).json({ message: `Question #${i + 1} must have at least 2 answer choices.` });
    }
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
      return res.status(400).json({ message: `Question #${i + 1} has an invalid correct answer selection.` });
    }
  }

  try {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    const cls = await Class.findById(classId);
    if (!cls || (cls.faculty.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Not authorized to configure quizzes for this class.' });
    }

    const parsedTimeLimit = Math.max(0, Number(timeLimit) || 0);
    const shouldShuffle = shuffleQuestions !== undefined ? Boolean(shuffleQuestions) : true;

    // Check if a quiz already exists for this lesson
    let quiz = await Quiz.findOne({ lessonId });

    if (quiz) {
      quiz.title = title.trim();
      quiz.questions = questions;
      quiz.passingScore = passingScore || 75;
      quiz.timeLimit = parsedTimeLimit;
      quiz.shuffleQuestions = shouldShuffle;
      await quiz.save();
    } else {
      quiz = await Quiz.create({
        classId,
        lessonId,
        title: title.trim(),
        passingScore: passingScore || 75,
        timeLimit: parsedTimeLimit,
        shuffleQuestions: shouldShuffle,
        questions,
      });
    }

    res.status(200).json({
      message: 'Quiz saved successfully.',
      quiz,
    });
  } catch (error) {
    console.error('Save quiz error:', error);
    res.status(500).json({ message: error.message || 'Failed to save quiz.' });
  }
};

// Helper to parse a single CSV or TSV row (handles quoted values with commas)
const parseDelimitedRow = (line) => {
  // If the line contains tabs and at least 5 tabs, treat as TSV (e.g. pasted from Excel)
  if ((line.match(/\t/g) || []).length >= 5) {
    return line.split('\t').map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
  }

  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^["']|["']$/g, '').trim());
};

// @desc    Bulk import questions from CSV / raw text
// @route   POST /api/quizzes/bulk-parse
// @access  Private (Faculty)
export const bulkParseQuestions = (req, res) => {
  const { rawText } = req.body;

  if (!rawText || !rawText.trim()) {
    return res.status(400).json({ message: 'Please provide CSV or text data to parse.' });
  }

  try {
    const cleanedText = rawText.replace(/^\uFEFF/, '').trim();
    const lines = cleanedText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const parsedQuestions = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = parseDelimitedRow(lines[i]);

      if (parts.length >= 6) {
        const questionText = parts[0];
        const options = [parts[1], parts[2], parts[3], parts[4]];
        const rawAns = parts[5].toUpperCase().trim();

        // Skip CSV header row if detected on the first row
        if (
          i === 0 &&
          (/^question/i.test(questionText) || /^correct/i.test(rawAns) || /^answer/i.test(rawAns))
        ) {
          continue;
        }

        if (!questionText || options.some((opt) => !opt)) {
          continue;
        }

        let correctAnswer = 0;
        if (rawAns === 'A' || rawAns === 'OPTION A' || rawAns === '0') correctAnswer = 0;
        else if (rawAns === 'B' || rawAns === 'OPTION B' || rawAns === '2') correctAnswer = 1;
        else if (rawAns === 'C' || rawAns === 'OPTION C' || rawAns === '3') correctAnswer = 2;
        else if (rawAns === 'D' || rawAns === 'OPTION D' || rawAns === '4') correctAnswer = 3;
        else if (rawAns === '1') correctAnswer = 0;
        else {
          const matchedOptionIdx = options.findIndex(
            (opt) => opt.toUpperCase().trim() === rawAns
          );
          if (matchedOptionIdx !== -1) {
            correctAnswer = matchedOptionIdx;
          }
        }

        parsedQuestions.push({
          questionText,
          options,
          correctAnswer,
          explanation: parts[6] || '',
        });
      }
    }

    if (parsedQuestions.length === 0) {
      return res.status(400).json({
        message:
          'Could not detect valid questions. Expected format: Question, Option A, Option B, Option C, Option D, CorrectLetter (A/B/C/D), OptionalExplanation',
      });
    }

    res.json({
      count: parsedQuestions.length,
      questions: parsedQuestions,
    });
  } catch (error) {
    console.error('Bulk parse error:', error);
    res.status(500).json({ message: 'Failed to parse questions.' });
  }
};

// @desc    Get quiz for taking or editing by lessonId or quizId
// @route   GET /api/quizzes/:id OR /api/quizzes/lesson/:lessonId
// @access  Private
export const getQuizByIdOrLesson = async (req, res) => {
  const targetId = req.params.lessonId || req.params.id;

  try {
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(200).json({ quiz: null, exists: false, message: 'Invalid lesson or quiz ID.' });
    }

    // Try finding by lessonId first, or by quiz _id
    let quiz = await Quiz.findOne({ lessonId: targetId });
    if (!quiz) {
      quiz = await Quiz.findById(targetId);
    }

    if (!quiz) {
      // Clean 200 response with quiz: null so the browser console doesn't spam red 404 errors
      return res.status(200).json({ 
        quiz: null, 
        exists: false, 
        message: 'No quiz has been created for this lesson yet.' 
      });
    }

    const cls = await Class.findById(quiz.classId);
    const isFaculty = cls && (cls.faculty.toString() === req.user._id.toString() || req.user.role === 'admin');

    // Fetch student's progress for this quiz
    const progress = await Progress.findOne({
      studentId: req.user._id,
      lessonId: quiz.lessonId,
    });

    if (isFaculty) {
      // Faculty sees all data including correct answers
      return res.json({
        ...quiz.toObject(),
        exists: true,
        isFaculty: true,
      });
    }

    // Student must finish viewing the topic presentation before taking the assessment
    if (!progress || (!progress.slidesViewed && !progress.passed)) {
      return res.status(403).json({
        slidesNotViewed: true,
        lessonId: quiz.lessonId,
        message: 'Please complete the topic presentation before starting the assessment.',
      });
    }

    // Student: Hide correctAnswer to prevent inspection in browser DevTools
    const sanitizedQuestions = quiz.questions.map((q, idx) => ({
      _id: q._id,
      index: idx,
      questionText: q.questionText,
      options: q.options,
    }));

    res.json({
      _id: quiz._id,
      classId: quiz.classId,
      lessonId: quiz.lessonId,
      title: quiz.title,
      passingScore: quiz.passingScore || 75,
      timeLimit: quiz.timeLimit || 0,
      shuffleQuestions: quiz.shuffleQuestions !== false,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
      exists: true,
      progress: progress
        ? {
            highestScore: progress.highestScore,
            latestScore: progress.latestScore,
            passed: progress.passed,
            attemptsCount: progress.quizAttempts?.length || 0,
            latestAttempt: progress.quizAttempts?.slice(-1)[0] || null,
          }
        : null,
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ message: 'Failed to load quiz.' });
  }
};

// @desc    Submit student quiz attempt & evaluate
// @route   POST /api/quizzes/:id/submit
// @access  Private (Student)
export const submitQuizAttempt = async (req, res) => {
  const { answers } = req.body;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ message: 'Answers array is required.' });
  }

  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const totalQuestions = quiz.questions.length;
    let rawScore = 0;

    // Build lookup by original question index so shuffled question/option order grades accurately
    const answerByOrigIdx = new Map();
    answers.forEach((ans, i) => {
      if (typeof ans === 'number') {
        answerByOrigIdx.set(i, { origOptionIndex: ans });
      } else if (ans && typeof ans === 'object') {
        const qIdx = typeof ans.questionIndex === 'number' ? ans.questionIndex : i;
        const origOptIdx =
          typeof ans.originalOptionIndex === 'number'
            ? ans.originalOptionIndex
            : typeof ans.selectedAnswer === 'number'
              ? ans.selectedAnswer
              : -1;
        answerByOrigIdx.set(qIdx, { origOptionIndex: origOptIdx });
      }
    });

    const rawEvaluation = quiz.questions.map((q, idx) => {
      const entry = answerByOrigIdx.get(idx);
      const selectedAnswer = entry ? entry.origOptionIndex : -1;
      const isCorrect = selectedAnswer === q.correctAnswer;
      if (isCorrect) {
        rawScore += 1;
      }
      return {
        questionIndex: idx,
        questionText: q.questionText,
        options: q.options,
        selectedAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation || '',
      };
    });

    const score = Math.round((rawScore / totalQuestions) * 100);
    const passingScore = quiz.passingScore || 75;
    const passed = score >= passingScore;

    // Assessment Integrity: Only reveal exact correct answers & explanations when student passes (>= 75%)
    const evaluatedAnswers = rawEvaluation.map((item) => ({
      questionIndex: item.questionIndex,
      questionText: item.questionText,
      selectedAnswer: item.selectedAnswer,
      isCorrect: item.isCorrect,
      ...(passed
        ? {
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
          }
        : {}),
    }));

    // Save attempt to Progress
    let progress = await Progress.findOne({
      studentId: req.user._id,
      lessonId: quiz.lessonId,
    });

    if (!progress) {
      progress = new Progress({
        studentId: req.user._id,
        classId: quiz.classId,
        lessonId: quiz.lessonId,
        slidesViewed: true,
        quizAttempts: [],
        highestScore: score,
        latestScore: score,
        passed: passed,
      });
    } else {
      progress.latestScore = score;
      if (score > progress.highestScore) {
        progress.highestScore = score;
      }
      if (passed) {
        progress.passed = true;
      }
      progress.updatedAt = new Date();
    }

    progress.quizAttempts.push({
      score,
      rawScore,
      totalQuestions,
      passed,
      answers: rawEvaluation.map((a) => ({
        questionIndex: a.questionIndex,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
      })),
      attemptDate: new Date(),
    });

    await progress.save();

    // Find the next lesson in sequence so the student can proceed directly once passed
    let nextLessonId = null;
    let nextLessonTitle = null;
    const currentLesson = await Lesson.findById(quiz.lessonId).select('classId order');
    if (currentLesson) {
      const nextLesson = await Lesson.findOne({
        classId: currentLesson.classId,
        order: currentLesson.order + 1,
      }).select('_id title');
      if (nextLesson) {
        nextLessonId = nextLesson._id;
        nextLessonTitle = nextLesson.title;
      }
    }

    res.json({
      score,
      rawScore,
      totalQuestions,
      passingScore,
      passed,
      answersRevealed: passed,
      highestScore: progress.highestScore,
      attemptsCount: progress.quizAttempts.length,
      evaluatedAnswers,
      nextLessonId: passed ? nextLessonId : null,
      nextLessonTitle: passed ? nextLessonTitle : null,
      message: passed
        ? `Congratulations! You scored ${score}% and passed the quiz. The next lesson is now unlocked.`
        : `You scored ${score}%. A minimum of ${passingScore}% is required to unlock the next lesson. Review the PowerPoint slides and retake the quiz (questions and choices will be reshuffled).`,
    });
  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({ message: 'Failed to process quiz submission.' });
  }
};
