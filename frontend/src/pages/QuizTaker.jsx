import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, HelpCircle, CheckCircle2, XCircle, 
  RotateCcw, AlertCircle, ChevronRight, Loader2, Clock, Shuffle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

// Fisher-Yates shuffle
const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildDisplayQuestions = (rawQuestions, shouldShuffle) => {
  const mapped = (rawQuestions || []).map((q, idx) => {
    const origQIndex = typeof q.index === 'number' ? q.index : idx;
    const optionItems = (q.options || []).map((optText, optIdx) => ({
      text: optText,
      originalOptionIndex: optIdx,
    }));
    return {
      _id: q._id,
      originalQuestionIndex: origQIndex,
      questionText: q.questionText,
      options: shouldShuffle ? shuffleArray(optionItems) : optionItems,
    };
  });

  return shouldShuffle ? shuffleArray(mapped) : mapped;
};

const QuizTaker = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quiz, setQuiz] = useState(null);
  const [displayQuestions, setDisplayQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // key: displayQuestionIndex -> displayOptionIndex
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(null);

  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const initAttemptSession = useCallback((quizData, forceShuffle = false) => {
    const shouldShuffle = forceShuffle || quizData.shuffleQuestions !== false;
    setDisplayQuestions(buildDisplayQuestions(quizData.questions, shouldShuffle));
    setSelectedAnswers({});
    setResult(null);
    autoSubmittedRef.current = false;
    if (quizData.timeLimit && quizData.timeLimit > 0) {
      setTimeLeftSeconds(quizData.timeLimit * 60);
    } else {
      setTimeLeftSeconds(null);
    }
  }, []);

  const loadQuiz = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get(`/quizzes/${quizId}`);
      if (!data || data.exists === false || !data.questions) {
        setError('No assessment quiz has been created for this topic yet.');
      } else {
        setQuiz(data);
        initAttemptSession(data);
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.slidesNotViewed) {
        toast.warning(
          'Please finish viewing the topic presentation first to unlock its assessment.',
          'Complete Presentation First'
        );
        if (err.response?.data?.lessonId) {
          navigate(`/student/lesson/${err.response.data.lessonId}`, { replace: true });
          return;
        }
      }
      setError(err.response?.data?.message || 'Could not load assessment quiz.');
    } finally {
      setLoading(false);
    }
  };

  const submitAttempt = useCallback(
    async (isAutoSubmit = false) => {
      if (!quiz || submitting) return;

      const answeredCount = Object.keys(selectedAnswers).length;
      if (!isAutoSubmit && answeredCount < displayQuestions.length) {
        if (
          !window.confirm(
            `You have answered ${answeredCount} of ${displayQuestions.length} questions. Unanswered questions will be marked incorrect. Do you want to submit anyway?`
          )
        ) {
          return;
        }
      }

      setSubmitting(true);
      setError('');

      try {
        // Map each displayed question back to its originalQuestionIndex and originalOptionIndex
        const answersPayload = displayQuestions.map((dispQ, dispQIdx) => {
          const chosenDispOptIdx = selectedAnswers[dispQIdx];
          const chosenOpt =
            chosenDispOptIdx !== undefined ? dispQ.options[chosenDispOptIdx] : null;
          return {
            questionIndex: dispQ.originalQuestionIndex,
            originalOptionIndex: chosenOpt ? chosenOpt.originalOptionIndex : -1,
          };
        });

        const { data } = await API.post(`/quizzes/${quiz._id}/submit`, {
          answers: answersPayload,
        });

        setResult(data);
        if (data.passed) {
          toast.success(
            `You scored ${data.score}% (${data.correctCount}/${data.totalQuestions}). Next topic unlocked!`,
            'Assessment Passed'
          );
        } else {
          toast.warning(
            `You scored ${data.score}%. A minimum score of 75% is required to pass.`,
            'Assessment Completed'
          );
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to submit quiz.');
      } finally {
        setSubmitting(false);
      }
    },
    [quiz, submitting, selectedAnswers, displayQuestions]
  );

  // Countdown Timer Effect
  useEffect(() => {
    if (timeLeftSeconds === null || result || loading) return;

    if (timeLeftSeconds <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submitAttempt(true);
      }
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeftSeconds, result, loading, submitAttempt]);

  const handleSelectOption = (qIndex, optIndex) => {
    if (result) return; // Prevent changing after submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [qIndex]: optIndex,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitAttempt(false);
  };

  const handleRetake = () => {
    if (quiz) {
      initAttemptSession(quiz, true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-purple-600" size={36} />
          <p className="text-sm font-medium text-gray-500">Loading assessment questions...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full border border-gray-100 shadow-sm text-center">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Assessment Error</h3>
          <p className="text-xs text-gray-500 mb-6">{error || 'Could not load quiz.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = displayQuestions.length;

  // Map evaluatedAnswers by original questionIndex for fast lookup
  const evaluationMap = new Map();
  if (result?.evaluatedAnswers) {
    result.evaluatedAnswers.forEach((ev) => {
      evaluationMap.set(ev.questionIndex, ev);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 md:px-12 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/student/class/${quiz.classId}`)}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 font-bold text-xs md:text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Course Syllabus</span>
            </button>
            <span className="text-gray-300">•</span>
            <button
              onClick={() => navigate(`/student/lesson/${quiz.lessonId}`)}
              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs md:text-sm transition-colors"
            >
              Return to Presentation
            </button>
          </div>

          {!result && (
            <div className="flex items-center gap-2.5">
              {timeLeftSeconds !== null && (
                <div
                  className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border ${
                    timeLeftSeconds <= 60
                      ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                      : timeLeftSeconds <= 180
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  <Clock size={14} />
                  <span className="font-mono">{formatTimer(timeLeftSeconds)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
                <HelpCircle size={15} />
                <span>{answeredCount} of {totalQuestions} Answered</span>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header Banner */}
        <div className="mb-6">
          <span className="text-xs font-bold text-purple-600 uppercase tracking-widest block mb-1">
            Mastery Assessment
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900">{quiz.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5">
            <span>{totalQuestions} Questions</span>
            <span>•</span>
            <span>Minimum Passing Score: <strong>{quiz.passingScore}%</strong></span>
            {quiz.timeLimit > 0 && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                  <Clock size={13} />
                  Time Limit: {quiz.timeLimit} mins
                </span>
              </>
            )}
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold">
              <Shuffle size={13} />
              Randomized Questions & Options
            </span>
          </div>
        </div>

        {/* Question Jump Navigator */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-2.5">
            <span>Question Navigator</span>
            <span>
              {result
                ? `${result.rawScore}/${result.totalQuestions} Correct`
                : `${answeredCount}/${totalQuestions} Answered`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayQuestions.map((q, idx) => {
              const isAnswered = selectedAnswers[idx] !== undefined;
              const evaluated = evaluationMap.get(q.originalQuestionIndex);
              let pillClass = 'bg-gray-100 text-gray-600 hover:bg-gray-200';
              if (result) {
                pillClass = evaluated?.isCorrect
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-500 text-white';
              } else if (isAnswered) {
                pillClass = 'bg-purple-600 text-white shadow-xs';
              }
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    document
                      .getElementById(`quiz-q-${idx}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className={`w-8 h-8 rounded-xl text-xs font-extrabold transition-all ${pillClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* RESULTS BANNER (DISPLAYED AFTER SUBMISSION) */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`rounded-3xl p-8 mb-8 border shadow-lg ${
                result.passed
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-600 shadow-green-200'
                  : 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-red-600 shadow-red-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {result.passed ? (
                      <CheckCircle2 size={24} className="text-white" />
                    ) : (
                      <AlertCircle size={24} className="text-white" />
                    )}
                    <span className="text-sm font-extrabold uppercase tracking-wider">
                      {result.passed ? 'Assessment Passed' : 'Assessment Not Passed'}
                    </span>
                  </div>

                  <h2 className="text-3xl md:text-4xl font-black">
                    Score: {result.score}%
                  </h2>
                  <p className="text-xs opacity-90 mt-1">
                    Correct Answers: {result.rawScore} of {result.totalQuestions} Questions • Required: {result.passingScore}%
                  </p>
                  <p className="text-xs mt-3 opacity-95 max-w-lg font-medium">
                    {result.message}
                  </p>

                  {!result.passed && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/20 text-white/95 text-[11px] font-semibold">
                      <ShieldAlert size={14} />
                      <span>
                        To maintain academic integrity, correct answers are only revealed upon achieving a passing score (75%). Questions and options are randomized on each attempt.
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5 shrink-0">
                  {result.passed ? (
                    <button
                      onClick={() =>
                        navigate(
                          result.nextLessonId
                            ? `/student/lesson/${result.nextLessonId}`
                            : `/student/class/${quiz.classId}`
                        )
                      }
                      className="px-6 py-3.5 bg-white text-green-800 rounded-2xl font-bold text-xs hover:bg-green-50 transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>
                        {result.nextLessonId ? 'Proceed to Next Topic' : 'Return to Course Syllabus'}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleRetake}
                        className="px-6 py-3.5 bg-white text-red-700 rounded-2xl font-bold text-xs hover:bg-red-50 transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={16} />
                        <span>Retake Assessment</span>
                      </button>
                      <button
                        onClick={() => navigate(`/student/lesson/${quiz.lessonId}`)}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ArrowLeft size={14} />
                        <span>Return to Presentation</span>
                      </button>
                    </>
                  )}

                  {result.passed && (
                    <button
                      onClick={handleRetake}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw size={14} />
                      Retake for higher score
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QUESTIONS LIST */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {displayQuestions.map((q, qIndex) => {
            const evaluated = evaluationMap.get(q.originalQuestionIndex);
            const isCorrect = evaluated?.isCorrect;
            const selectedOpt = selectedAnswers[qIndex];

            return (
              <div
                id={`quiz-q-${qIndex}`}
                key={`${q.originalQuestionIndex}-${qIndex}`}
                className={`p-6 rounded-3xl border transition-all ${
                  result
                    ? isCorrect
                      ? 'bg-white border-green-300 shadow-sm'
                      : 'bg-white border-red-300 shadow-sm'
                    : selectedOpt !== undefined
                      ? 'bg-white border-purple-200 shadow-sm'
                      : 'bg-white border-gray-200/80 shadow-sm'
                }`}
              >
                {/* Question Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-purple-700 uppercase tracking-wider bg-purple-50 px-2.5 py-1 rounded-lg">
                    Question {qIndex + 1} of {totalQuestions}
                  </span>

                  {result && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                      isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                    }`}>
                      {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <h3 className="text-base font-bold text-gray-900 mb-4 leading-relaxed">
                  {q.questionText}
                </h3>

                {/* Options */}
                <div className="space-y-2.5">
                  {q.options.map((opt, optIndex) => {
                    const isSelected = selectedOpt === optIndex;
                    // Only reveal the exact correct option if the student passed the quiz (or got this question right)
                    const isTheCorrectAnswer =
                      result?.passed &&
                      typeof evaluated?.correctAnswer === 'number' &&
                      evaluated.correctAnswer === opt.originalOptionIndex;

                    let optionStyle = 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100/70';

                    if (result) {
                      if (isTheCorrectAnswer || (isSelected && isCorrect)) {
                        optionStyle = 'bg-green-50 border-green-500 text-green-900 font-bold ring-1 ring-green-500';
                      } else if (isSelected && !isCorrect) {
                        optionStyle = 'bg-red-50 border-red-500 text-red-900 line-through';
                      }
                    } else if (isSelected) {
                      optionStyle = 'bg-purple-50 border-purple-600 text-purple-900 font-bold ring-1 ring-purple-600';
                    }

                    return (
                      <div
                        key={optIndex}
                        onClick={() => handleSelectOption(qIndex, optIndex)}
                        className={`p-3.5 rounded-2xl border text-xs md:text-sm flex items-center gap-3 transition-all cursor-pointer ${optionStyle}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-600'
                        }`}>
                          {String.fromCharCode(65 + optIndex)}
                        </span>
                        <span className="flex-1 leading-snug">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation in Result mode (only shown when passed) */}
                {result?.passed && evaluated?.explanation && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
                    <strong>Explanation:</strong> {evaluated.explanation}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submit Button */}
          {!result && (
            <div className="sticky bottom-6 z-20 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-all shadow-xl shadow-purple-300 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Grading Assessment...
                  </>
                ) : (
                  `Submit Quiz (${answeredCount} of ${totalQuestions} answered)`
                )}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};

export default QuizTaker;
