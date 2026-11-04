import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Plus, Users, Calendar, 
  Copy, Check, FileText, Presentation, HelpCircle, 
  Trash2, Edit, Printer, Loader2, Sparkles, AlertCircle,
  Search, UserX, Award, CheckCircle2, Clock, Eye, RefreshCw, ChevronRight,
  ArrowUp, ArrowDown, Megaphone, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import CreateLessonModal from '../components/CreateLessonModal';
import CreateClassModal from '../components/CreateClassModal';
import QuizBuilderModal from '../components/QuizBuilderModal';
import ClassReportModal from '../components/ClassReportModal';
import StudentDetailModal from '../components/StudentDetailModal';

const FacultyClassView = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    ['syllabus', 'students', 'announcements'].includes(initialTab) ? initialTab : 'syllabus'
  );

  const [classData, setClassData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Enrolled students state
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Completed' | 'In Progress' | 'Not Started'
  const [studentSortBy, setStudentSortBy] = useState('surname'); // 'surname' | 'score'
  const [studentSortOrder, setStudentSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [removingStudentId, setRemovingStudentId] = useState(null);

  // Modals state
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonToEdit, setLessonToEdit] = useState(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [selectedLessonForQuiz, setSelectedLessonForQuiz] = useState(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [reorderingLessonId, setReorderingLessonId] = useState(null);

  // Announcement form state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementDueDate, setAnnouncementDueDate] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Sync tab with URL
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (['syllabus', 'students', 'announcements'].includes(tabParam) && activeTab !== tabParam) {
      setActiveTab(tabParam);
    }
    if (searchParams.get('addTopic') === 'true') {
      setActiveTab('syllabus');
      setLessonToEdit(null);
      setIsLessonModalOpen(true);
      setSearchParams({ tab: 'syllabus' }, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    loadClassAndLessons();
    loadStudents();
  }, [classId]);

  const loadClassAndLessons = async () => {
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
      setError(err.response?.data?.message || 'Failed to load class details.');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const res = await API.get(`/classes/${classId}/students`);
      setEnrolledStudents(res.data.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (classData?.classCode) {
      navigator.clipboard.writeText(classData.classCode);
      setCopied(true);
      toast.info(
        `Class join code ${classData.classCode} copied to clipboard.`,
        'Join Code Copied'
      );
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson and its quiz?')) return;

    try {
      await API.delete(`/lessons/${lessonId}`);
      toast.success('Topic and its associated assessment have been removed.', 'Topic Deleted');
      loadClassAndLessons();
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete lesson.', 'Delete Failed');
    }
  };

  const handleReorderLesson = async (lessonId, direction) => {
    setReorderingLessonId(lessonId);
    try {
      await API.put(`/lessons/${lessonId}/reorder`, { direction });
      toast.success('Syllabus topic sequence updated.', 'Order Saved');
      await loadClassAndLessons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reorder lesson.', 'Reorder Failed');
    } finally {
      setReorderingLessonId(null);
    }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    setPostingAnnouncement(true);
    try {
      const { data } = await API.post(`/classes/${classId}/announcements`, {
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
        dueDate: announcementDueDate || null,
      });
      setClassData((prev) => ({
        ...prev,
        announcements: data.announcements,
      }));
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementDueDate('');
      toast.success(
        'Announcement has been published to all enrolled students.',
        'Announcement Posted'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post announcement.', 'Post Failed');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const { data } = await API.delete(`/classes/${classId}/announcements/${announcementId}`);
      setClassData((prev) => ({
        ...prev,
        announcements: data.announcements,
      }));
      toast.info('Announcement has been removed.', 'Announcement Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete announcement.', 'Delete Failed');
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName || 'this student'} from the subject? Their enrolled progress will be reset.`)) {
      return;
    }

    setRemovingStudentId(studentId);
    try {
      await API.delete(`/classes/${classId}/students/${studentId}`);
      toast.info(
        `${studentName || 'Student'} has been removed from this class.`,
        'Student Removed'
      );
      await Promise.all([loadStudents(), loadClassAndLessons()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove student.', 'Action Failed');
    } finally {
      setRemovingStudentId(null);
    }
  };

  const toggleStudentSort = (field) => {
    if (studentSortBy === field) {
      setStudentSortOrder(studentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setStudentSortBy(field);
      setStudentSortOrder(field === 'score' ? 'desc' : 'asc');
    }
  };

  // Filter and sort students based on search, status, and surname / score
  const filteredStudents = enrolledStudents
    .filter((student) => {
      const matchesSearch =
        student.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.formattedName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.email?.toLowerCase().includes(studentSearch.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const isAsc = studentSortOrder === 'asc';
      const getSurname = (s) => {
        if (s.surname) return s.surname;
        const raw = String(s.name || '').trim();
        if (raw.includes(',')) return raw.split(',')[0].trim();
        const parts = raw.split(/\s+/);
        return parts[parts.length - 1] || '';
      };

      if (studentSortBy === 'score') {
        const diff = isAsc
          ? (a.averageScore || 0) - (b.averageScore || 0)
          : (b.averageScore || 0) - (a.averageScore || 0);
        if (diff !== 0) return diff;
      }

      const surnameCompare = getSurname(a).localeCompare(getSurname(b), undefined, {
        sensitivity: 'base',
      });
      return isAsc || studentSortBy === 'score' ? surnameCompare : -surnameCompare;
    });

  const completedStudentsCount = enrolledStudents.filter(s => s.status === 'Completed').length;
  const inProgressStudentsCount = enrolledStudents.filter(s => s.status === 'In Progress').length;
  const classAvgScore = enrolledStudents.length > 0
    ? Math.round(enrolledStudents.reduce((acc, s) => acc + (s.averageScore || 0), 0) / enrolledStudents.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={36} />
          <p className="text-sm font-medium text-gray-500">Loading Course Management...</p>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full border border-gray-100 shadow-sm text-center">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Class Not Accessible</h3>
          <p className="text-xs text-gray-500 mb-6">{error || 'Could not load class.'}</p>
          <button
            onClick={() => navigate('/faculty')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Breadcrumb Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 md:px-12 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
            <Link
              to="/faculty"
              className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 font-bold transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
              <span>Faculty Dashboard</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
            <span className="font-extrabold text-gray-900 truncate">
              {classData.subjectCode} — {classData.name}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 border border-emerald-200"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Class Grade Report</span>
              <span className="sm:hidden">Report</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Class Banner */}
      <header className="bg-white border-b border-gray-200 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-extrabold uppercase tracking-wider">
                {classData.subjectCode}
              </span>
              <span className="text-xs font-semibold text-gray-500">
                {classData.term} • AY {classData.year}
              </span>
              <button
                onClick={() => setIsEditClassModalOpen(true)}
                className="ml-1 px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition-colors"
                title="Edit Class Details"
              >
                <Edit size={12} />
                Edit Class
              </button>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">{classData.name}</h1>
            {classData.description && (
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">{classData.description}</p>
            )}
          </div>

          {/* Student Class Code Share Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-5 shrink-0 shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-0.5">
                Student Class Code
              </span>
              <span className="text-2xl font-black text-blue-950 font-mono tracking-widest">
                {classData.classCode}
              </span>
              <span className="text-[10px] text-gray-500 block">Give to students to enroll</span>
            </div>
            <button
              onClick={handleCopyCode}
              className={`p-3 rounded-xl transition-all ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-white hover:bg-blue-600 hover:text-white text-gray-700 shadow-sm'
              }`}
              title="Copy Class Code"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-8 flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => handleTabChange('syllabus')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all relative ${
              activeTab === 'syllabus'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <BookOpen size={17} />
            <span>Course Syllabus & Topics</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === 'syllabus'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {lessons.length}
            </span>
            {activeTab === 'syllabus' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => handleTabChange('students')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all relative ${
              activeTab === 'students'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users size={17} />
            <span>Enrolled Students</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === 'students'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {enrolledStudents.length}
            </span>
            {activeTab === 'students' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => handleTabChange('announcements')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all relative ${
              activeTab === 'announcements'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Megaphone size={17} />
            <span>Announcements & Deadlines</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === 'announcements'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {classData.announcements?.length || 0}
            </span>
            {activeTab === 'announcements' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
              />
            )}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        {activeTab === 'syllabus' ? (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Course Syllabus & Topics</h2>
                <p className="text-xs text-gray-500">
                  Topics are unlocked sequentially. Students must achieve at least 75% on each topic assessment to advance.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-2 rounded-xl">
                  {lessons.length} {lessons.length === 1 ? 'Topic' : 'Topics'} Published
                </span>
                <button
                  onClick={() => {
                    setLessonToEdit(null);
                    setIsLessonModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  <span>Add Topic</span>
                </button>
              </div>
            </div>

            {lessons.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Course Topics Published</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
                  Begin building your course syllabus by adding your first topic presentation and configuring its mastery assessment.
                </p>
                <button
                  onClick={() => {
                    setLessonToEdit(null);
                    setIsLessonModalOpen(true);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white font-bold text-xs rounded-2xl hover:bg-blue-700 shadow-sm transition-all inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Add First Topic</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {lessons.map((lesson, idx) => (
                  <motion.div
                    key={lesson._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                        {lesson.order}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{lesson.title}</h3>
                        
                        {/* Lesson Meta Badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {lesson.presentationType === 'create' ||
                          (lesson.presentationType !== 'upload' &&
                            lesson.slides?.length > 0 &&
                            !lesson.attachments?.length) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                              <Presentation size={13} className="text-blue-600" />
                              Interactive Slides ({lesson.slides?.length || 0})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                              <Presentation size={13} className="text-indigo-600" />
                              {lesson.attachments?.[0]?.fileName
                                ? `Presentation Deck: ${lesson.attachments[0].fileName}`
                                : 'Presentation Pending'}
                            </span>
                          )}

                          {/* Quiz Status Badge */}
                          {lesson.hasQuiz ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              <CheckCircle2 size={13} />
                              Assessment: {lesson.quizQuestionCount} Questions (75% Passing)
                              {lesson.quizTimeLimit > 0 && ` • ${lesson.quizTimeLimit}m`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                              <AlertCircle size={13} />
                              Assessment Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                      {/* Reorder Up/Down Buttons */}
                      <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                        <button
                          type="button"
                          disabled={idx === 0 || reorderingLessonId === lesson._id}
                          onClick={() => handleReorderLesson(lesson._id, 'up')}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Move Topic Up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === lessons.length - 1 || reorderingLessonId === lesson._id}
                          onClick={() => handleReorderLesson(lesson._id, 'down')}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Move Topic Down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setLessonToEdit(lesson);
                          setIsLessonModalOpen(true);
                        }}
                        className="px-3.5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                        title="Edit Topic & Presentation"
                      >
                        <Edit size={13} />
                        <span>Edit Topic</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedLessonForQuiz(lesson);
                          setIsQuizModalOpen(true);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          lesson.hasQuiz
                            ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                            : 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs'
                        }`}
                      >
                        <HelpCircle size={14} />
                        {lesson.hasQuiz ? 'Edit Assessment' : 'Create Assessment'}
                      </button>

                      <button
                        onClick={() => handleDeleteLesson(lesson._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete Topic"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'students' ? (
          /* Enrolled Students Tab */
          <div>
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Users size={20} />
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Total Enrolled
                </span>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{enrolledStudents.length}</p>
                <span className="text-[10px] text-gray-400">Students in this subject</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Completed Subject
                </span>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{completedStudentsCount}</p>
                <span className="text-[10px] text-gray-400">Passed all {lessons.length} topics</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Clock size={20} />
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  In Progress
                </span>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{inProgressStudentsCount}</p>
                <span className="text-[10px] text-gray-400">Actively completing lessons</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                  <Award size={20} />
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Class Average Score
                </span>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{classAvgScore}%</p>
                <span className="text-[10px] text-gray-400">Target passing score: 75%</span>
              </div>
            </div>

            {/* Controls Bar: Search, Sort (by Surname / Score), Status Filter & Summary Export */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search enrolled students by surname, name, or email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">Sort by:</span>
                  <button
                    type="button"
                    onClick={() => toggleStudentSort('surname')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      studentSortBy === 'surname'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    By Surname {studentSortBy === 'surname' && (studentSortOrder === 'asc' ? '(A–Z) ↑' : '(Z–A) ↓')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStudentSort('score')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      studentSortBy === 'score'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    By Score {studentSortBy === 'score' && (studentSortOrder === 'desc' ? '(High–Low) ↓' : '(Low–High) ↑')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors inline-flex items-center gap-1.5 ml-1"
                  >
                    <Printer size={13} />
                    <span>Summary Print / PDF / Spreadsheet</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">Status:</span>
                {['all', 'Completed', 'In Progress', 'Not Started'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {st === 'all' ? 'All Students' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Students List */}
            {studentsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <span className="text-xs font-semibold">Loading student roster...</span>
              </div>
            ) : enrolledStudents.length === 0 ? (
              /* No Students Enrolled Yet State */
              <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Students Enrolled Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
                  Share your Subject Class Code with your students. Once they enter this code in their student portal, they will automatically appear here.
                </p>
                <div className="inline-flex items-center gap-3 bg-blue-50/80 border border-blue-200/80 px-6 py-3 rounded-2xl">
                  <span className="text-xs font-bold text-blue-700">Student Code:</span>
                  <span className="font-mono font-black text-blue-950 text-base tracking-widest">
                    {classData.classCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 bg-white text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg shadow-sm transition-all"
                    title="Copy Code"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ) : filteredStudents.length === 0 ? (
              /* No search results */
              <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center shadow-sm">
                <p className="text-sm font-semibold text-gray-700">No students match your search.</p>
                <button
                  onClick={() => {
                    setStudentSearch('');
                    setStatusFilter('all');
                  }}
                  className="mt-3 text-xs font-bold text-blue-600 hover:underline"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              /* Enrolled Students Table / Cards */
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-4 px-6">Student (Surname, First Name)</th>
                        <th className="py-4 px-6">Syllabus Progress</th>
                        <th className="py-4 px-6">Avg. Quiz Score</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredStudents.map((student) => (
                        <tr key={student._id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Student Info */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm shadow-blue-200">
                                {(student.surname || student.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block leading-tight">
                                  {student.formattedName || student.name}
                                </span>
                                <span className="text-[11px] text-gray-400 block mt-0.5">
                                  {student.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Progress */}
                          <td className="py-4 px-6">
                            <div className="w-48">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 mb-1">
                                <span>{student.completedLessonsCount || 0} of {student.totalLessons || 0} Lessons</span>
                                <span className="font-bold text-gray-900">{student.progressPercent || 0}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    student.isCompleted
                                      ? 'bg-emerald-500'
                                      : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${student.progressPercent || 0}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-xl font-bold text-xs ${
                                (student.averageScore || 0) >= 75
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : student.averageScore > 0
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {student.averageScore || 0}%
                              </span>
                              <span className="text-[10px] text-gray-400">
                                ({student.totalAttempts || 0} {student.totalAttempts === 1 ? 'quiz attempt' : 'quiz attempts'})
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                              student.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : student.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                student.status === 'Completed'
                                  ? 'bg-emerald-600'
                                  : student.status === 'In Progress'
                                  ? 'bg-blue-600'
                                  : 'bg-gray-400'
                              }`} />
                              {student.status || 'Enrolled'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedStudentForDetail(student)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                                title="View Detailed Topic Scores"
                              >
                                <Eye size={13} />
                                View Details
                              </button>

                              <button
                                onClick={() => handleRemoveStudent(student._id, student.name)}
                                disabled={removingStudentId === student._id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Remove Student from Subject"
                              >
                                {removingStudentId === student._id ? (
                                  <Loader2 size={15} className="animate-spin text-red-600" />
                                ) : (
                                  <UserX size={15} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Showing {filteredStudents.length} of {enrolledStudents.length} enrolled students</span>
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>View printable performance report</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Announcements & Deadlines Tab */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Post New Announcement Form */}
            <div className="lg:col-span-1">
              <form
                onSubmit={handlePostAnnouncement}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 sticky top-24"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Post Class Announcement</h3>
                    <p className="text-[11px] text-gray-500">Notify all enrolled students</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Title / Headline
                  </label>
                  <input
                    type="text"
                    required
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="e.g. Midterm Exam Schedule & Coverage"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Announcement Details
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="Write instructions, reminders, or study guidelines for your students..."
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Target Date / Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={announcementDueDate}
                    onChange={(e) => setAnnouncementDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={postingAnnouncement}
                  className="w-full py-3 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {postingAnnouncement ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Post Announcement
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Announcements Feed */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Class Announcements Stream</h2>
                <span className="text-xs font-bold text-gray-400">
                  {classData.announcements?.length || 0} Posted
                </span>
              </div>

              {!classData.announcements || classData.announcements.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                  <Megaphone className="mx-auto text-gray-300 mb-3" size={36} />
                  <h3 className="text-base font-bold text-gray-900 mb-1">No Announcements Yet</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Post updates, quiz deadlines, or exam reminders on the left to keep your enrolled students informed.
                  </p>
                </div>
              ) : (
                classData.announcements.map((ann) => (
                  <div
                    key={ann._id}
                    className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900">{ann.title}</h4>
                        {ann.dueDate && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Calendar size={12} />
                            Deadline: {new Date(ann.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                        {ann.content}
                      </p>
                      <span className="text-[11px] text-gray-400 block pt-1">
                        Posted {new Date(ann.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteAnnouncement(ann._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                      title="Delete Announcement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Class Modal */}
      <CreateClassModal
        isOpen={isEditClassModalOpen}
        onClose={() => setIsEditClassModalOpen(false)}
        classToEdit={classData}
        onClassCreated={() => loadClassAndLessons()}
      />

      {/* Student Details Modal */}
      <StudentDetailModal
        isOpen={!!selectedStudentForDetail}
        onClose={() => setSelectedStudentForDetail(null)}
        student={selectedStudentForDetail}
        className={classData.name}
        subjectCode={classData.subjectCode}
      />

      {/* Create / Edit Lesson Modal */}
      <CreateLessonModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        classId={classId}
        lessonToEdit={lessonToEdit}
        nextTopicNumber={lessons.length + 1}
        onLessonSaved={() => {
          loadClassAndLessons();
          loadStudents();
        }}
      />

      {/* Quiz Builder Modal */}
      {selectedLessonForQuiz && (
        <QuizBuilderModal
          isOpen={isQuizModalOpen}
          onClose={() => {
            setIsQuizModalOpen(false);
            setSelectedLessonForQuiz(null);
          }}
          lessonId={selectedLessonForQuiz._id}
          classId={classId}
          lessonTitle={selectedLessonForQuiz.title}
          onQuizSaved={() => {
            loadClassAndLessons();
            loadStudents();
          }}
        />
      )}

      {/* Class Report & Print Modal */}
      <ClassReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        classId={classId}
      />
    </div>
  );
};

export default FacultyClassView;
