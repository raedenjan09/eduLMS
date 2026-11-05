import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Users, FileText, Plus, LogOut,
  Copy, Check, ChevronRight, AlertCircle, Loader2,
  Edit, Trash2, Settings, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API from '../api/axios';
import CreateClassModal from '../components/CreateClassModal';
import ProfileModal from '../components/ProfileModal';

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [termFilter, setTermFilter] = useState('all');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/classes/faculty');
      setClasses(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your classes.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('You have been signed out safely.', 'Signed Out');
    navigate('/login');
  };

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.info(`Class join code ${code} copied to clipboard.`, 'Join Code Copied');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteClass = async (e, cls) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${cls.subjectCode} - ${cls.name}"? All lessons, quizzes, uploaded files, and student progress in this class will be deleted.`
      )
    ) {
      return;
    }

    try {
      await API.delete(`/classes/${cls._id}`);
      toast.success(`"${cls.subjectCode} — ${cls.name}" has been deleted.`, 'Class Deleted');
      loadClasses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete class.', 'Delete Failed');
    }
  };

  const totalStudents = classes.reduce((acc, c) => acc + (c.studentCount || 0), 0);
  const totalLessons = classes.reduce((acc, c) => acc + (c.lessonCount || 0), 0);

  const stats = [
    { label: 'Managed Classes', value: classes.length.toString(), icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Enrolled Students', value: totalStudents.toString(), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Published Topics', value: totalLessons.toString(), icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  const uniqueTerms = ['all', ...Array.from(new Set(classes.map((c) => c.term).filter(Boolean)))];

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch =
      cls.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.subjectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.classCode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTerm = termFilter === 'all' || cls.term === termFilter;
    return matchesSearch && matchesTerm;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 md:px-12 py-3 sm:py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shrink-0">
            <BookOpen className="text-white h-5 w-5" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-gray-900 tracking-tight block leading-none">
              EduLMS
            </span>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
              Faculty Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setIsProfileOpen(true)}
            title="Profile & Password Settings"
            className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.name}
                className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg object-cover border border-gray-200"
              />
            ) : (
              <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                {user?.name?.charAt(0)?.toUpperCase() || 'F'}
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
            className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Faculty Dashboard
            </h1>
            <p className="text-gray-500 mt-1 text-xs md:text-sm">
              Select a class below to manage topics, presentations, assessments, and student records.
            </p>
          </div>
          <button
            onClick={() => {
              setClassToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xs text-xs md:text-sm shrink-0"
          >
            <Plus size={17} />
            <span>Create Class</span>
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4"
            >
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl shrink-0`}>
                <stat.icon size={20} />
              </div>
              <div>
                <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">{stat.label}</h3>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Classes List */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Managed Classes</h2>
              <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md">
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
                    placeholder="Search subject or code..."
                    className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-52"
                  />
                </div>
                {uniqueTerms.length > 2 && (
                  <select
                    value={termFilter}
                    onChange={(e) => setTermFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
                  >
                    {uniqueTerms.map((t) => (
                      <option key={t} value={t}>
                        {t === 'all' ? 'All Semesters' : t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="animate-spin text-blue-600" size={30} />
              <span className="text-xs font-medium">Loading classes...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-12 text-center">
              <div className="bg-blue-50 text-blue-600 p-4 rounded-xl w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <BookOpen size={26} />
              </div>
              <h2 className="text-base font-bold text-gray-900">No Classes Created Yet</h2>
              <p className="text-gray-500 mt-1.5 max-w-sm mx-auto text-xs leading-relaxed">
                Create your first class to generate a student enrollment code and publish course topics.
              </p>
              <button
                onClick={() => {
                  setClassToEdit(null);
                  setIsCreateModalOpen(true);
                }}
                className="mt-5 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 shadow-xs transition-all inline-flex items-center gap-2"
              >
                <Plus size={15} />
                <span>Create First Class</span>
              </button>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-10 text-center">
              <p className="text-sm font-bold text-gray-700">No classes match your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTermFilter('all');
                }}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClasses.map((cls) => (
                <motion.div
                  key={cls._id}
                  whileHover={{ y: -2 }}
                  onClick={() => navigate(`/faculty/class/${cls._id}`)}
                  className="bg-white rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all overflow-hidden flex flex-col cursor-pointer group"
                >
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-100 rounded-md text-xs font-bold uppercase tracking-wider">
                          {cls.subjectCode}
                        </span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs font-medium text-gray-400 mr-1">
                            {cls.term}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setClassToEdit(cls);
                              setIsCreateModalOpen(true);
                            }}
                            title="Edit Class Details"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClass(e, cls)}
                            title="Delete Class"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-0.5">
                        {cls.name}
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        AY {cls.year}
                      </p>
                    </div>

                    {/* Compact Enrollment Code Bar */}
                    <div
                      onClick={(e) => handleCopyCode(e, cls.classCode)}
                      className="px-3.5 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl flex items-center justify-between hover:border-blue-200 transition-colors"
                      title="Click to copy Student Enrollment Code"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-gray-500">
                          Class Code:
                        </span>
                        <span className="text-sm font-bold text-gray-900 font-mono tracking-wider">
                          {cls.classCode}
                        </span>
                      </div>
                      <span
                        className={`p-1.5 rounded-lg transition-all ${
                          copiedCode === cls.classCode
                            ? 'bg-emerald-600 text-white'
                            : 'text-gray-400 hover:text-blue-600'
                        }`}
                      >
                        {copiedCode === cls.classCode ? <Check size={14} /> : <Copy size={14} />}
                      </span>
                    </div>
                  </div>

                  {/* Minimal Card Footer */}
                  <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <Users size={13} className="text-gray-400" />
                        <span><strong className="text-gray-800">{cls.studentCount || 0}</strong> Students</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FileText size={13} className="text-gray-400" />
                        <span><strong className="text-gray-800">{cls.lessonCount || 0}</strong> Topics</span>
                      </span>
                    </div>

                    <span className="font-semibold text-blue-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      <span>Open</span>
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Class Modal */}
      <CreateClassModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setClassToEdit(null);
        }}
        classToEdit={classToEdit}
        onClassCreated={() => loadClasses()}
      />

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
};

export default FacultyDashboard;
