import Class from '../models/Class.js';
import Lesson from '../models/Lesson.js';
import Quiz from '../models/Quiz.js';
import Progress from '../models/Progress.js';

// Helper to extract surname, first name, and "Surname, First Name" display format
export const extractSurnameAndFormat = (rawName = '') => {
  const cleaned = String(rawName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return { surname: '', firstName: '', formattedName: 'Unnamed Student' };
  }

  // If already in "Surname, First Name" format
  if (cleaned.includes(',')) {
    const [lastPart, ...restParts] = cleaned.split(',');
    const surname = lastPart.trim();
    const firstName = restParts.join(',').trim();
    return {
      surname,
      firstName,
      formattedName: firstName ? `${surname}, ${firstName}` : surname,
    };
  }

  const tokens = cleaned.split(' ');
  if (tokens.length === 1) {
    return { surname: tokens[0], firstName: '', formattedName: tokens[0] };
  }

  // Handle common name suffixes (Jr., Sr., II, III, IV, V)
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
  let suffix = '';
  if (tokens.length > 2 && suffixes.has(tokens[tokens.length - 1].toLowerCase())) {
    suffix = tokens.pop();
  }

  // Handle compound surname prefixes (e.g. Dela Cruz, De Guzman, Delos Santos, De La Cruz, San Jose, Sta. Maria)
  const singlePrefixes = new Set(['de', 'del', 'dela', 'delos', 'san', 'sta', 'sta.', 'sto', 'sto.', 'van', 'von']);
  let surnameTokens = [tokens.pop()];

  if (tokens.length >= 2) {
    const prev = tokens[tokens.length - 1].toLowerCase();
    const prev2 = tokens.length >= 3 ? tokens[tokens.length - 2].toLowerCase() : '';
    if ((prev === 'la' || prev === 'los' || prev === 'las') && prev2 === 'de') {
      surnameTokens.unshift(tokens.pop());
      surnameTokens.unshift(tokens.pop());
    } else if (singlePrefixes.has(prev)) {
      surnameTokens.unshift(tokens.pop());
    }
  }

  const surname = surnameTokens.join(' ');
  const firstNameBase = tokens.join(' ');
  const firstName = suffix ? `${firstNameBase} ${suffix}`.trim() : firstNameBase;

  return {
    surname,
    firstName,
    formattedName: firstName ? `${surname}, ${firstName}` : surname,
  };
};

// @desc    Get class progress and grade report with summary
// @route   GET /api/reports/class/:classId
// @access  Private (Faculty/Admin)
export const getClassReport = async (req, res) => {
  const { classId } = req.params;
  const { sortBy = 'surname', order = 'asc' } = req.query; // sortBy: 'surname' | 'name' | 'score'; order: 'asc' | 'desc'

  try {
    const cls = await Class.findById(classId)
      .populate('faculty', 'name email')
      .populate('students', 'name email createdAt');

    if (!cls) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (cls.faculty._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view reports for this class.' });
    }

    const lessons = await Lesson.find({ classId }).sort({ order: 1 });
    const quizzes = await Quiz.find({ classId });
    const quizMap = new Map();
    quizzes.forEach(q => quizMap.set(q.lessonId.toString(), q));

    const allProgresses = await Progress.find({ classId });
    const progressMap = new Map(); // key: "studentId-lessonId"
    allProgresses.forEach(p => {
      progressMap.set(`${p.studentId.toString()}-${p.lessonId.toString()}`, p);
    });

    const studentReports = cls.students.map((student) => {
      let totalRawScore = 0;
      let totalPossibleScore = 0;
      let totalPercentageScore = 0;
      let gradedQuizzesCount = 0;
      let completedLessonsCount = 0;
      let hasStarted = false;

      const lessonBreakdown = lessons.map((lesson) => {
        const prog = progressMap.get(`${student._id.toString()}-${lesson._id.toString()}`);
        const quiz = quizMap.get(lesson._id.toString());
        const hasQuiz = !!quiz;
        const totalQuestions = quiz?.questions?.length || 0;
        const highestScore = prog?.highestScore || 0;
        const passed = prog?.passed || false;
        const attempts = prog?.quizAttempts?.length || 0;
        const slidesViewed = prog?.slidesViewed || false;

        let rawScore = 0;
        if (prog?.quizAttempts && prog.quizAttempts.length > 0) {
          const bestAttempt = prog.quizAttempts.reduce((best, curr) => {
            if (!best) return curr;
            return (curr.score > best.score) ? curr : best;
          }, null);

          if (bestAttempt) {
            rawScore = typeof bestAttempt.rawScore === 'number'
              ? bestAttempt.rawScore
              : Math.round(((bestAttempt.score || highestScore) / 100) * (bestAttempt.totalQuestions || totalQuestions));
          }
        } else if (highestScore > 0 && totalQuestions > 0) {
          rawScore = Math.round((highestScore / 100) * totalQuestions);
        }

        if (slidesViewed || attempts > 0 || passed) {
          hasStarted = true;
        }

        if (hasQuiz && totalQuestions > 0) {
          totalPossibleScore += totalQuestions;
          if (attempts > 0) {
            totalRawScore += rawScore;
            totalPercentageScore += highestScore;
            gradedQuizzesCount += 1;
          }
        }

        if (passed) {
          completedLessonsCount += 1;
        }

        return {
          lessonId: lesson._id,
          order: lesson.order,
          title: lesson.title,
          hasQuiz,
          totalQuestions,
          rawScore,
          highestScore,
          passed,
          attempts,
          scoreDisplay: !hasQuiz ? 'N/A' : attempts > 0 ? `${rawScore}/${totalQuestions}` : '—',
        };
      });

      const averageScore = gradedQuizzesCount > 0 
        ? Math.round(totalPercentageScore / gradedQuizzesCount) 
        : 0;

      const allPassed = lessons.length > 0 && completedLessonsCount === lessons.length;
      const { surname, firstName, formattedName } = extractSurnameAndFormat(student.name);

      return {
        studentId: student._id,
        name: student.name,
        surname,
        firstName,
        formattedName,
        email: student.email,
        totalRawScore,
        totalPossibleScore,
        totalScoreDisplay: totalPossibleScore > 0 ? `${totalRawScore}/${totalPossibleScore}` : `${totalRawScore}`,
        averageScore,
        completedLessonsCount,
        totalLessons: lessons.length,
        isCompleted: allPassed,
        status: allPassed 
          ? 'Completed' 
          : hasStarted 
            ? 'In Progress' 
            : 'Not Started',
        lessons: lessonBreakdown,
      };
    });

    // Apply sorting (by surname or by score)
    const isAsc = order === 'asc';
    const compareBySurname = (a, b) => {
      const surnameDiff = a.surname.localeCompare(b.surname, undefined, { sensitivity: 'base' });
      if (surnameDiff !== 0) return surnameDiff;
      return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' });
    };

    studentReports.sort((a, b) => {
      if (sortBy === 'score') {
        const rawScoreDiff = isAsc ? a.totalRawScore - b.totalRawScore : b.totalRawScore - a.totalRawScore;
        if (rawScoreDiff !== 0) return rawScoreDiff;
        const avgDiff = isAsc ? a.averageScore - b.averageScore : b.averageScore - a.averageScore;
        if (avgDiff !== 0) return avgDiff;
        return compareBySurname(a, b);
      }
      // Default sort by surname (also handles sortBy === 'surname' or 'name')
      return isAsc ? compareBySurname(a, b) : compareBySurname(b, a);
    });

    // Compute Summary Stats
    const totalStudents = studentReports.length;
    const classAvg = totalStudents > 0
      ? Math.round(studentReports.reduce((acc, s) => acc + s.averageScore, 0) / totalStudents)
      : 0;

    const studentsPassedAll = studentReports.filter(s => s.isCompleted).length;
    const passingRate = totalStudents > 0 
      ? Math.round((studentsPassedAll / totalStudents) * 100) 
      : 0;

    const summary = {
      subjectCode: cls.subjectCode,
      className: cls.name,
      term: cls.term,
      year: cls.year,
      classCode: cls.classCode,
      instructor: cls.faculty.name,
      totalStudents,
      totalLessons: lessons.length,
      classAverageScore: classAvg,
      passingRate,
      studentsPassedAll,
      generatedAt: new Date().toISOString(),
    };

    res.json({
      summary,
      students: studentReports,
      lessons: lessons.map(l => ({ _id: l._id, order: l.order, title: l.title })),
    });
  } catch (error) {
    console.error('Get class report error:', error);
    res.status(500).json({ message: 'Failed to generate class report.' });
  }
};

