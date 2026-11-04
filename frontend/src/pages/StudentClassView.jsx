import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Lock, CheckCircle2, 
  HelpCircle, Presentation, FileText, AlertCircle, Loader2, ChevronRight,
  Megaphone, Calendar, PlayCircle, RotateCcw, ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../api/axios';

const StudentClassView = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [classData, setClassData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockedModalInfo, setLockedModalInfo] = useState(null);

  useEffect(() => {
    loadClassData();
  }, [classId]);

  const loadClassData = async () => {
    setLoading(true);
    setError('');
    try {
      const [classRes, lessonsRes] = await Promise.all([
        API.get(`/classes/${classId}`),
        API.get(`/lessons/class/${classId}`),
      ]);
      setClassData(classRes.data);
      setLessons(lessonsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load class syllabus.');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lesson) => {
    if (lesson.isLocked) {
      setLockedModalInfo({
        lessonTitle: lesson.title,
        reason: lesson.lockReason || 'You must complete the previous lesson and score at least 75% on its quiz first.',
      });
    } else {
      navigate(`/student/lesson/${lesson._id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={36} />
          <p className="text-sm font-medium text-gray-500">Loading syllabus & progress...</p>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full border border-gray-100 shadow-sm text-center">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Class Error</h3>
          <p className="text-xs text-gray-500 mb-6">{error || 'Could not load class syllabus.'}</p>
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold"
          >
            Back to Portal
          </button>
        </div>
      </div>
    );
  }

  const completedCount = lessons.filter((l) => l.progress?.passed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const isCourseCompleted = lessons.length > 0 && progressPercent === 100;

  // Find the current unlocked lesson that hasn't been passed yet
  const currentActiveLesson =
    lessons.find((l) => !l.isLocked && !l.progress?.passed) || lessons[0] || null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Breadcrumb Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 md:px-12 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
            <Link
              to="/student"
              className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 font-bold transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
              <span>Student Portal</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
            <span className="font-extrabold text-gray-900 truncate">
              {classData.subjectCode} — {classData.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-gray-500 hidden sm:inline">Mastery Progress:</span>
            <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
              isCourseCompleted
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-indigo-50 text-indigo-600'
            }`}>
              {completedCount} / {lessons.length} Lessons ({progressPercent}%)
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="bg-white border-b border-gray-200 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-extrabold uppercase tracking-wider">
                {classData.subjectCode}
              </span>
              <span className="text-xs font-semibold text-gray-500">
                {classData.term} • AY {classData.year}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">{classData.name}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Instructor: <strong className="text-gray-700">{classData.faculty?.name}</strong>
            </p>

            {/* Progress bar */}
            <div className="mt-5 max-w-xl">
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCourseCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-1.5 font-medium">
                <span>Sequential Mastery: Review the lesson presentation and score at least 75% on the assessment to advance</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          </div>

          {/* Quick Jump to Current Lesson */}
          {currentActiveLesson && (
            <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-4 lg:w-96 shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                  {isCourseCompleted ? 'Course Completed' : `Current Module • Lesson ${currentActiveLesson.order}`}
                </span>
                <h3 className="text-sm font-bold text-gray-900 truncate mt-0.5">
                  {currentActiveLesson.title}
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {isCourseCompleted
                    ? 'All lessons and assessments completed'
                    : 'Review presentation & complete assessment (75%)'}
                </p>
              </div>
              <button
                onClick={() => navigate(`/student/lesson/${currentActiveLesson._id}`)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-xs transition-all"
              >
                <PlayCircle size={15} />
                <span>{isCourseCompleted ? 'Review' : 'Continue'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8 space-y-8">
        {/* Announcements Stream (if any) */}
        {classData.announcements && classData.announcements.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone size={17} className="text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">
                Instructor Announcements ({classData.announcements.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classData.announcements.map((ann) => (
                <div
                  key={ann._id}
                  className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{ann.title}</h3>
                    {ann.dueDate && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Calendar size={12} />
                        Due: {new Date(ann.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                    {ann.content}
                  </p>
                  <span className="text-[10px] text-gray-400 block pt-1">
                    Posted {new Date(ann.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* List of Lessons */}
        {lessons.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
            <BookOpen className="mx-auto text-gray-300 mb-3" size={36} />
            <h3 className="text-base font-bold text-gray-900 mb-1">No Lessons Published</h3>
            <p className="text-xs text-gray-500">Your instructor has not published any lessons yet.</p>
          </div>
        ) : (() => {
          const midIndex = Math.ceil(lessons.length / 2);
          const leftColLessons = lessons.slice(0, midIndex);
          const rightColLessons = lessons.slice(midIndex);

          const renderTocItem = (lesson) => {
            const isLocked = lesson.isLocked;
            const isPassed = lesson.progress?.passed;
            const isCurrentActive = currentActiveLesson?._id === lesson._id && !isPassed && !isLocked;

            return (
              <button
                key={lesson._id}
                type="button"
                onClick={() => handleLessonClick(lesson)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 group ${
                  isCurrentActive
                    ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/15 shadow-xs'
                    : isPassed
                      ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/80'
                      : isLocked
                        ? 'bg-gray-50/80 border-gray-200/80 opacity-75 hover:border-amber-300'
                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Number Badge — Circled when active/unlocked like (1) */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                      isCurrentActive
                        ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-600 shadow-xs'
                        : isPassed
                          ? 'bg-emerald-600 text-white ring-2 ring-offset-2 ring-emerald-500'
                          : isLocked
                            ? 'bg-gray-200 text-gray-500 border border-gray-300'
                            : 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500'
                    }`}
                  >
                    {lesson.order}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                        Lesson {lesson.order}
                      </span>
                      {isCurrentActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                          Current
                        </span>
                      )}
                      {isPassed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Passed ({lesson.progress?.highestScore || 0}%)
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 inline-flex items-center gap-1">
                          <Lock size={10} />
                          Locked
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm font-bold truncate mt-0.5 ${
                        isLocked ? 'text-gray-500' : 'text-gray-900 group-hover:text-indigo-700'
                      }`}
                    >
                      {lesson.title}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors">
                  {isLocked ? (
                    <Lock size={15} className="text-gray-400" />
                  ) : isPassed ? (
                    <CheckCircle2 size={17} className="text-emerald-600" />
                  ) : (
                    <ChevronRight size={17} />
                  )}
                </div>
              </button>
            );
          };

          return (
            <section className="bg-white rounded-3xl border border-gray-200/90 p-6 md:p-7 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <ListOrdered size={18} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-extrabold text-gray-900">
                      List of Lessons
                    </h2>
                    <p className="text-xs text-gray-500">
                      Select an unlocked lesson to open its presentation. Circled number indicates your active lesson.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-bold text-gray-500 shrink-0">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-offset-1 ring-indigo-600 inline-block" />
                    Current Lesson
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                    Completed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
                    Locked
                  </span>
                </div>
              </div>

              {/* 2-Column Vertical Layout (1, 2, 3 on left | 4, 5, 6 on right) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {leftColLessons.map((lesson) => renderTocItem(lesson))}
                </div>
                {rightColLessons.length > 0 && (
                  <div className="space-y-3">
                    {rightColLessons.map((lesson) => renderTocItem(lesson))}
                  </div>
                )}
              </div>
            </section>
          );
        })()}
      </main>

      {/* POP-UP ERROR / WARNING MODAL FOR LOCKED LESSON */}
      <AnimatePresence>
        {lockedModalInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden text-center p-6"
            >
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock size={30} />
              </div>

              <h3 className="text-xl font-black text-gray-900 mb-1">Lesson Is Currently Locked</h3>
              <p className="text-xs font-bold text-indigo-600 mb-4">{lockedModalInfo.lessonTitle}</p>

              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-left text-xs text-amber-900 leading-relaxed mb-6">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <AlertCircle size={15} />
                  Prerequisite Requirement:
                </div>
                {lockedModalInfo.reason}
              </div>

              <p className="text-xs text-gray-500 mb-6">
                You must view the previous topic's PowerPoint presentation and pass its quiz with at least <strong>75%</strong> before this lesson unlocks.
              </p>

              <button
                onClick={() => setLockedModalInfo(null)}
                className="w-full bg-gray-900 text-white py-3 rounded-2xl font-bold text-xs hover:bg-gray-800 transition-all shadow-md"
              >
                Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentClassView;
