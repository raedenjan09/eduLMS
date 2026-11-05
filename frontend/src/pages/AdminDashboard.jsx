import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Users,
  BookOpen,
  BarChart3,
  LogOut,
  Search,
  Trash2,
  Loader2,
  AlertCircle,
  Printer,
  ExternalLink,
  RefreshCw,
  Settings,
  GraduationCap,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API from '../api/axios';
import ClassReportModal from '../components/ClassReportModal';
import ProfileModal from '../components/ProfileModal';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'classes'
  const [overview, setOverview] = useState({
    stats: {
      totalUsers: 0,
      totalStudents: 0,
      totalFaculty: 0,
      totalAdmins: 0,
      totalClasses: 0,
      totalLessons: 0,
      totalQuizzes: 0,
    },
    users: [],
    classes: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [classSearch, setClassSearch] = useState('');

  // Action states
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [deletingClassId, setDeletingClassId] = useState(null);
  const [reportClassId, setReportClassId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/auth/admin/overview');
      setOverview(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin overview.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('You have been signed out safely.', 'Signed Out');
    navigate('/login');
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    setUpdatingUserId(targetUserId);
    try {
      await API.put(`/auth/admin/users/${targetUserId}/role`, { role: newRole });
      toast.success(`User role updated to "${newRole}".`, 'Role Updated');
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user role.', 'Update Failed');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete user "${targetUser.name}" (${targetUser.email})?`
      )
    ) {
      return;
    }

    setDeletingUserId(targetUser._id);
    try {
      await API.delete(`/auth/admin/users/${targetUser._id}`);
      toast.success(`User "${targetUser.name}" has been deleted.`, 'User Deleted');
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user.', 'Delete Failed');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteClass = async (cls) => {
    if (
      !window.confirm(
        `Are you sure you want to delete class "${cls.subjectCode} - ${cls.name}" and all its lessons, quizzes, and student progress?`
      )
    ) {
      return;
    }

    setDeletingClassId(cls._id);
    try {
      await API.delete(`/classes/${cls._id}`);
      toast.success(`"${cls.subjectCode} — ${cls.name}" has been deleted.`, 'Class Deleted');
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete class.', 'Delete Failed');
    } finally {
      setDeletingClassId(null);
    }
  };

  const { stats, users, classes } = overview;

  const statCards = [
    {
      label: 'Total Registered Users',
      value: stats.totalUsers || 0,
      sub: `${stats.totalStudents || 0} Students • ${stats.totalFaculty || 0} Faculty`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: 'Active Classes',
      value: stats.totalClasses || 0,
      sub: 'Across all academic terms',
      icon: BookOpen,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      label: 'Published Topics',
      value: stats.totalLessons || 0,
      sub: 'Sequential mastery lessons',
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
    },
    {
      label: 'Active Assessments',
      value: stats.totalQuizzes || 0,
      sub: '75% passing threshold',
      icon: HelpCircle,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
  ];

  const filteredUsers = (users || []).filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredClasses = (classes || []).filter((c) => {
    return (
      c.name?.toLowerCase().includes(classSearch.toLowerCase()) ||
      c.subjectCode?.toLowerCase().includes(classSearch.toLowerCase()) ||
      c.classCode?.toLowerCase().includes(classSearch.toLowerCase()) ||
      c.faculty?.name?.toLowerCase().includes(classSearch.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 md:px-12 py-3 sm:py-4 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="bg-purple-600 p-2 rounded-xl shrink-0">
            <ShieldCheck className="text-white h-5 w-5" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">EduLMS Admin</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsProfileOpen(true)}
            title="Profile & Password Settings"
            className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-2xl hover:bg-gray-100 transition-colors"
          >
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.name}
                className="w-7 sm:w-8 h-7 sm:h-8 rounded-xl object-cover border border-gray-200"
              />
            ) : (
              <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">{user?.name}</div>
              <div className="text-[11px] text-gray-400 capitalize">{user?.role}</div>
            </div>
            <Settings size={16} className="text-gray-400" />
          </button>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 sm:p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Oversee registered students & faculty, manage user roles, and monitor all active classes and reports.
            </p>
          </div>
          <button
            onClick={loadOverview}
            disabled={loading}
            className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all self-start"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-purple-600' : ''} />
            Refresh Platform Data
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {statCards.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl w-fit mb-4`}>
                <stat.icon size={22} />
              </div>
              <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{stat.label}</h3>
              <p className="text-3xl font-black text-gray-900 mt-1">{stat.value}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all relative ${
              activeTab === 'users' ? 'text-purple-600' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users size={17} />
            <span>User Management</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === 'users' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {users?.length || 0}
            </span>
            {activeTab === 'users' && (
              <motion.div
                layoutId="adminTabLine"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-all relative ${
              activeTab === 'classes' ? 'text-purple-600' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <BookOpen size={17} />
            <span>Active Classes & Reports</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === 'classes' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {classes?.length || 0}
            </span>
            {activeTab === 'classes' && (
              <motion.div
                layoutId="adminTabLine"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full"
              />
            )}
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 className="animate-spin text-purple-600" size={32} />
            <span className="text-sm font-medium">Loading platform data...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold flex items-center gap-2 border border-red-100">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : activeTab === 'users' ? (
          /* USERS MANAGEMENT TAB */
          <div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 mr-1">Role:</span>
                {['all', 'student', 'faculty', 'admin'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      roleFilter === r
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r === 'all' ? 'All Roles' : r}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6">Current Role</th>
                      <th className="py-4 px-6">Joined</th>
                      <th className="py-4 px-6 text-right">Manage Role / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredUsers.map((u) => {
                      const isSelf = u._id === user?._id;
                      return (
                        <tr key={u._id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {u.profilePicture ? (
                                <img
                                  src={u.profilePicture}
                                  alt={u.name}
                                  className="w-9 h-9 rounded-xl object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-gray-900 block leading-tight">
                                  {u.name}{' '}
                                  {isSelf && (
                                    <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded ml-1">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-gray-400">{u.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.role === 'faculty'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-gray-500">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={u.role}
                                disabled={updatingUserId === u._id || isSelf}
                                onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
                              >
                                <option value="student">Student</option>
                                <option value="faculty">Faculty</option>
                                <option value="admin">Admin</option>
                              </select>

                              {!isSelf && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={deletingUserId === u._id}
                                  title="Delete User"
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                  {deletingUserId === u._id ? (
                                    <Loader2 size={15} className="animate-spin text-red-600" />
                                  ) : (
                                    <Trash2 size={15} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* CLASSES & REPORTS OVERSIGHT TAB */
          <div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search classes by subject code, title, class code, or faculty..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              <span className="text-xs font-bold text-gray-400">
                {filteredClasses.length} {filteredClasses.length === 1 ? 'Class' : 'Classes'}
              </span>
            </div>

            {filteredClasses.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                <BookOpen className="mx-auto text-gray-300 mb-3" size={36} />
                <h3 className="text-base font-bold text-gray-900">No Matching Classes Found</h3>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-4 px-6">Class / Subject</th>
                        <th className="py-4 px-6">Faculty Instructor</th>
                        <th className="py-4 px-6">Class Code</th>
                        <th className="py-4 px-6">Enrollment & Topics</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredClasses.map((cls) => (
                        <tr key={cls._id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-4 px-6">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-black uppercase tracking-wider">
                              {cls.subjectCode}
                            </span>
                            <div className="font-bold text-gray-900 mt-1">{cls.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {cls.term} • AY {cls.year}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <div className="font-semibold text-gray-800">
                              {cls.faculty?.name || 'Unknown'}
                            </div>
                            <div className="text-[11px] text-gray-400">{cls.faculty?.email}</div>
                          </td>

                          <td className="py-4 px-6">
                            <span className="font-mono font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                              {cls.classCode}
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3 text-gray-600 font-semibold">
                              <span>{cls.studentCount || 0} Students</span>
                              <span>•</span>
                              <span>{cls.lessonCount || 0} Topics</span>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setReportClassId(cls._id)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold inline-flex items-center gap-1 border border-emerald-200 transition-colors"
                              >
                                <Printer size={13} />
                                Report
                              </button>

                              <Link
                                to={`/faculty/class/${cls._id}`}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink size={13} />
                                Open
                              </Link>

                              <button
                                onClick={() => handleDeleteClass(cls)}
                                disabled={deletingClassId === cls._id}
                                title="Delete Class"
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                {deletingClassId === cls._id ? (
                                  <Loader2 size={15} className="animate-spin text-red-600" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Printable Class Report Modal */}
      {reportClassId && (
        <ClassReportModal
          isOpen={!!reportClassId}
          onClose={() => setReportClassId(null)}
          classId={reportClassId}
        />
      )}

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
};

export default AdminDashboard;
