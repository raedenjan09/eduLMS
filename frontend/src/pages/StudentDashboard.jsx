import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  GraduationCap, Award, LogOut, 
  KeyRound, ChevronRight, CheckCircle2, AlertCircle, Loader2,
  UserMinus, Settings, Search, PlayCircle, BookOpen
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API from '../api/axios';
import JoinClassModal from '../components/JoinClassModal';
import ProfileModal from '../components/ProfileModal';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState('all'); // 'all' | 'in-progress' | 'completed'
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [leavingClassId, setLeavingClassId] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/classes/student');
      setClasses(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your enrolled classes.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('You have been signed out safely.', 'Signed Out');
    navigate('/login');
  };

  const handleUnenroll = async (e, cls) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to unenroll from "${cls.subjectCode} - ${cls.name}"? Your lesson and quiz progress for this class will be cleared.`
      )
    ) {
      return;
    }

    setLeavingClassId(cls._id);
    try {
      await API.post(`/classes/${cls._id}/leave`);
      toast.info(
        `You have unenrolled from "${cls.subjectCode} — ${cls.name}".`,
        'Unenrolled from Class'
      );
      loadClasses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unenroll from class.', 'Action Failed');
    } finally {
      setLeavingClassId(null);
    }
  };

  const totalLessons = classes.reduce((acc, c) => acc + (c.lessonCount || 0), 0);
  const totalCompleted = classes.reduce((acc, c) => acc + (c.completedLessons || 0), 0);
  const overallProgress = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const stats = [
    { label: 'Enrolled Subjects', value: classes.length.toString(), icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Passed Topics (≥75%)', value: `${totalCompleted} / ${totalLessons}`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Overall Mastery', value: `${overallProgress}%`, icon: Award, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch =
      cls.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.subjectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.faculty?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (progressFilter === 'completed') return (cls.progressPercent || 0) === 100;
    if (progressFilter === 'in-progress') return (cls.progressPercent || 0) < 100;
    return true;
  });

  // Find a class in progress for the quick-resume banner
  const activeClassToResume = classes.find(
    (c) => (c.lessonCount || 0) > 0 && (c.progressPercent || 0) < 100
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 md:px-12 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-sm shadow-indigo-200">
            <GraduationCap className="text-white h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-black text-gray-900 tracking-tight block leading-none">
              EduLMS
            </span>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
              Student Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsProfileOpen(true)}
            title="Profile & Password Settings"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl hover:bg-gray-100 transition-colors"
          >
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.name}
                className="w-8 h-8 rounded-xl object-cover border border-gray-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                {user?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
            )}
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-gray-900 leading-tight">{user?.name}</div>
              <div className="text-[10px] text-gray-400">Account Settings</div>
            </div>
            <Settings size={15} className="text-gray-400" />
          </button>

          <button 
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {/* Welcome Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Welcome back, {user?.name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="text-gray-500 mt-1 text-xs md:text-sm">
              1. Open your subject • 2. Study the PowerPoint slides • 3. Pass the quiz (≥75%) to unlock the next lesson.
            </p>
          </div>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 text-xs md:text-sm shrink-0"
          >
            <KeyRound size={17} />
            <span>Join Class with Code</span>
          </button>
        </header>

        {/* Quick Continue Banner if student has an active course */}
        {activeClassToResume && (
          <div className="mb-8 p-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <PlayCircle size={26} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200 block">
                  Continue Where You Left Off ({activeClassToResume.progressPercent || 0}% Complete)
                </span>
                <h3 className="text-base md:text-lg font-black">
                  {activeClassToResume.subjectCode}: {activeClassToResume.name}
                </h3>
                <p className="text-xs text-indigo-100">
                  {activeClassToResume.completedLessons || 0} of {activeClassToResume.lessonCount || 0} topics passed
                </p>
              </div>
            </div>
            <Link
              to={`/student/class/${activeClassToResume._id}`}
              className="px-5 py-3 bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm shrink-0 transition-all"
            >
              <span>Continue Learning</span>
              <ChevronRight size={15} />
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4"
            >
              <div className={`${stat.bg} ${stat.color} p-3.5 rounded-2xl shrink-0`}>
                <stat.icon size={22} />
              </div>
              <div>
                <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">{stat.label}</h3>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Enrolled Classes Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Your Enrolled Subjects</h2>
              <span className="text-xs font-extrabold bg-gray-200 text-gray-700 px-2.5 py-0.5 rounded-full">
                {filteredClasses.length}
              </span>
            </div>

            {classes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search subject or instructor..."
                    className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-52"
                  />
                </div>
                <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 text-xs font-bold">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'in-progress', label: 'In Progress' },
                    { id: 'completed', label: 'Completed' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setProgressFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        progressFilter === tab.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <span className="text-sm font-medium">Loading enrolled courses...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold flex items-center gap-2 border border-red-100">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="bg-indigo-50 text-indigo-600 p-5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <GraduationCap size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">No classes enrolled yet</h2>
              <p className="text-gray-500 mt-2 max-w-sm mx-auto text-xs leading-relaxed">
                Ask your instructor for the 6-character Class Code and click below to join your subject.
              </p>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-xs hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all inline-flex items-center gap-2"
              >
                <KeyRound size={16} />
                Enter Class Code
              </button>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
              <BookOpen className="mx-auto text-gray-300 mb-2" size={30} />
              <p className="text-sm font-bold text-gray-700">No subjects match your filter.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setProgressFilter('all');
                }}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
              >
                Reset search & filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((cls) => (
                <motion.div
                  key={cls._id}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(`/student/class/${cls._id}`)}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all overflow-hidden flex flex-col cursor-pointer group"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-xl text-xs font-black uppercase tracking-wider">
                        {cls.subjectCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-400">
                          {cls.term}
                        </span>
                        <button
                          onClick={(e) => handleUnenroll(e, cls)}
                          disabled={leavingClassId === cls._id}
                          title="Leave / Unenroll from Class"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {leavingClassId === cls._id ? (
                            <Loader2 size={14} className="animate-spin text-red-600" />
                          ) : (
                            <UserMinus size={14} />
                          )}
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Instructor: <span className="font-semibold text-gray-700">{cls.faculty?.name || 'Faculty'}</span>
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-3 border-t border-gray-50">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-gray-500">Topic Mastery</span>
                        <span className={cls.progressPercent === 100 ? 'text-emerald-600' : 'text-indigo-600'}>
                          {cls.progressPercent || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cls.progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${cls.progressPercent || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                        <span>{cls.completedLessons || 0} of {cls.lessonCount || 0} topics passed</span>
                        <span>Pass quiz ≥75%</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="px-6 py-3.5 bg-gray-50 group-hover:bg-indigo-50/60 border-t border-gray-100 flex items-center justify-between transition-colors">
                    <span className="text-xs font-semibold text-gray-500">
                      AY {cls.year}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                      {(cls.progressPercent || 0) > 0 && (cls.progressPercent || 0) < 100
                        ? 'Continue Topics'
                        : 'Open Subject'}
                      <ChevronRight size={15} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Join Class Modal */}
      <JoinClassModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onClassJoined={() => loadClasses()}
      />

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
};

export default StudentDashboard;
