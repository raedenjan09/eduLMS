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

// Helper: Safely extract JSON array from LLM output (handles raw JSON or markdown codeblocks)
const extractJsonArray = (text) => {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonStr = cleaned.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('extractJsonArray slice parse failed:', e.message);
    }
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    return null;
  }
  return null;
};

// Call xAI Grok API (sole external AI engine)
const callGrokAI = async (text, targetCount, difficulty, apiKey, model = 'grok-beta') => {
  const selectedModel = model === 'grok-2' ? 'grok-2-latest' : 'grok-beta';
  const prompt = `You are an expert academic educator designing an assessment for higher education students.
Based STRICTLY on the following presentation/lecture content, generate exactly ${targetCount} high-quality, academic multiple-choice questions.
Target Difficulty: ${difficulty}.

Requirements:
1. Each question must test comprehension, definitions, or applied knowledge from the provided material.
2. Provide exactly 4 distinct, plausible answer choices for each question.
3. Indicate the correct answer using a 0-based integer index (0 for Option A, 1 for Option B, 2 for Option C, 3 for Option D).
4. Provide a clear, brief explanation explaining why the correct choice is accurate.
5. Return ONLY a valid JSON array of objects without Markdown formatting:
[
  {
    "questionText": "Question statement here",
    "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "correctAnswer": 0,
    "explanation": "Brief explanation"
  }
]

Presentation Material:
${text.slice(0, 30000)}`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: 'You are an academic test maker. Always return strictly a raw JSON array matching the requested schema without markdown backticks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errMsg = errorBody?.error || errorBody?.message || `xAI Grok HTTP status ${response.status}`;
    throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  const questions = extractJsonArray(rawContent);
  if (!questions || questions.length < 10) {
    throw new Error('xAI Grok returned an incomplete or invalid question array.');
  }
  return questions;
};

// Built-in intelligent heuristic extractor (zero-config fallback if no external API key is configured)
const generateHeuristicQuestions = (text, targetCount = 10) => {
  const cleanLines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-*•–—\d.)\s]+/, '').trim())
    .filter((l) => l.length > 15 && l.length < 220);

  const concepts = [];
  cleanLines.forEach((line) => {
    const match =
      line.match(/^([^:–—]+)[:–—]\s*(.+)$/) ||
      line.match(/^([A-Za-z\s]{3,35})\s+(is|are|refers to|means|enables|defines)\s+(.+)$/i);
    if (match) {
      concepts.push({
        term: match[1].trim(),
        definition: (match[3] || match[2]).trim(),
      });
    } else if (line.split(' ').length >= 5) {
      concepts.push({
        term: line.split(' ').slice(0, 4).join(' '),
        definition: line,
      });
    }
  });

  const pool =
    concepts.length >= targetCount
      ? concepts
      : [...concepts, ...cleanLines.map((l) => ({ term: l.slice(0, 30), definition: l }))];

  const questions = [];
  const total = Math.min(20, Math.max(10, targetCount));

  for (let i = 0; i < total; i++) {
    const item =
      pool[i % pool.length] || {
        term: `Topic Concept ${i + 1}`,
        definition: `Core learning objective covered in topic presentation ${i + 1}`,
      };

    const distractors = pool
      .filter((_, idx) => idx !== (i % pool.length))
      .map((d) => d.term || d.definition.slice(0, 35))
      .filter(Boolean)
      .slice(0, 3);

    while (distractors.length < 3) {
      distractors.push(`Alternative Principle ${distractors.length + 1}`);
    }

    const correctIndex = i % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, item.term);

    questions.push({
      questionText: `Which of the following best corresponds to: "${item.definition.slice(0, 150)}${item.definition.length > 150 ? '...' : ''}"?`,
      options: options.slice(0, 4),
      correctAnswer: correctIndex,
      explanation: `According to the presentation material, "${item.term}" directly describes: ${item.definition.slice(0, 140)}.`,
    });
  }

  return questions;
};

// @desc    Generate quiz questions using xAI Grok scanning of presentation content
// @route   POST /api/quizzes/generate-ai
// @access  Private (Faculty)
export const generateQuizWithAI = async (req, res) => {
  const { lessonId, contentText, questionCount = 10, difficulty = 'medium', apiKey, model = 'grok-beta' } = req.body;
  const targetCount = Math.min(20, Math.max(10, Number(questionCount) || 10));

  let extractedText = (contentText || '').trim();

  // If contentText was not passed directly, load from lesson model slides
  if (!extractedText && lessonId && mongoose.Types.ObjectId.isValid(lessonId)) {
    try {
      const lesson = await Lesson.findById(lessonId);
      if (lesson) {
        if (lesson.slides && lesson.slides.length > 0) {
          extractedText = lesson.slides
            .map(
              (s, i) =>
                `Slide ${i + 1}: ${s.title || ''}\n${s.content || ''}\n${(s.bullets || []).join('\n')}`
            )
            .join('\n\n');
        }
        if (lesson.summary) {
          extractedText += `\n\nLesson Summary:\n${lesson.summary}`;
        }
      }
    } catch (err) {
      console.warn('Could not read lesson for Grok AI generator:', err);
    }
  }

  if (!extractedText || extractedText.length < 15) {
    return res.status(400).json({
      message:
        'No readable text content found in the presentation. Please upload a presentation file or provide lesson text.',
    });
  }

  const cleanKey = (apiKey || '').trim();
  const grokKey = cleanKey || process.env.XAI_API_KEY || process.env.GROK_API_KEY;

  let warningNotice = null;

  // 1. Solely use xAI Grok if key is provided or present in environment
  if (grokKey) {
    try {
      const grokQuestions = await callGrokAI(extractedText, targetCount, difficulty, grokKey, model);
      return res.json({
        source: 'grok',
        model: model === 'grok-2' ? 'grok-2' : 'grok-beta',
        count: grokQuestions.length,
        questions: grokQuestions.slice(0, 20).map((q) => ({
          questionText: String(q.questionText || '').trim(),
          options: (q.options || []).slice(0, 4).map((opt) => String(opt || '').trim()),
          correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
          explanation: String(q.explanation || '').trim(),
        })),
      });
    } catch (grokErr) {
      console.warn('xAI Grok API call error:', grokErr.message);
      warningNotice = grokErr.message.includes('credit') || grokErr.message.includes('permission-denied')
        ? 'xAI team has no active credits on console.x.ai. Emergency heuristic extractor was used so you can proceed.'
        : `xAI Grok notice: ${grokErr.message}`;
    }
  } else {
    warningNotice = 'No xAI Grok API key found. Using heuristic presentation parser.';
  }

  // 2. Built-in intelligent heuristic generator fallback (ensures faculty is never blocked if Grok credits expire)
  const fallbackQuestions = generateHeuristicQuestions(extractedText, targetCount);
  return res.json({
    source: 'built-in-heuristic',
    count: fallbackQuestions.length,
    warning: warningNotice,
    questions: fallbackQuestions,
  });
};
