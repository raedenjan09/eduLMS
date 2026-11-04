import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Calendar, Hash, Check, Loader2 } from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

// Academic year rolls over in June (e.g. Nov 2026 -> "2026-2027", Mar 2027 -> "2026-2027")
const getCurrentAcademicYear = () => {
  const now = new Date();
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};

// Dropdown options: 2 past years, current year, and 3 upcoming years
const buildAcademicYearOptions = (selectedYear) => {
  const currentStart = Number(getCurrentAcademicYear().split('-')[0]);
  const options = [];
  for (let start = currentStart - 2; start <= currentStart + 3; start++) {
    options.push(`${start}-${start + 1}`);
  }
  // Keep an existing class's saved year selectable even if it is outside the range
  if (selectedYear && !options.includes(selectedYear)) {
    options.unshift(selectedYear);
  }
  return options;
};

const CreateClassModal = ({ isOpen, onClose, onClassCreated, classToEdit = null }) => {
  const isEditing = Boolean(classToEdit);
  const toast = useToast();

  const [formData, setFormData] = useState({
    subjectCode: '',
    name: '',
    term: '1st Semester',
    year: getCurrentAcademicYear(),
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdClass, setCreatedClass] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setCreatedClass(null);
      if (classToEdit) {
        setFormData({
          subjectCode: classToEdit.subjectCode || '',
          name: classToEdit.name || '',
          term: classToEdit.term || '1st Semester',
          year: classToEdit.year || getCurrentAcademicYear(),
          description: classToEdit.description || '',
        });
      } else {
        setFormData({
          subjectCode: '',
          name: '',
          term: '1st Semester',
          year: getCurrentAcademicYear(),
          description: '',
        });
      }
    }
  }, [isOpen, classToEdit]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        const { data } = await API.put(`/classes/${classToEdit._id}`, formData);
        toast.success(
          `Changes to "${data.subjectCode} — ${data.name}" have been saved.`,
          'Class Updated'
        );
        if (onClassCreated) onClassCreated(data);
        onClose();
      } else {
        const { data } = await API.post('/classes', formData);
        setCreatedClass(data);
        toast.success(
          `"${data.subjectCode} — ${data.name}" created with Join Code ${data.classCode}.`,
          'Class Created'
        );
        if (onClassCreated) onClassCreated(data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Failed to ${isEditing ? 'update' : 'create'} class. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setCreatedClass(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl text-white">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isEditing ? 'Edit Class Details' : 'Create New Class'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isEditing
                    ? 'Update course name, subject code, or term'
                    : 'Set up course details for your students'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDone}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form or Success View */}
          <div className="p-6">
            {createdClass ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={32} />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Class Created Successfully!</h4>
                <p className="text-sm text-gray-600 max-w-sm mx-auto">
                  Share this unique <strong>Class Code</strong> with your students so they can join this class:
                </p>
                <div className="p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl max-w-xs mx-auto">
                  <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block">Student Class Code</span>
                  <span className="text-3xl font-black tracking-widest text-blue-900 select-all font-mono">
                    {createdClass.classCode}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  (Subject Code: <span className="font-semibold">{createdClass.subjectCode}</span>)
                </p>
                <button
                  onClick={handleDone}
                  className="w-full mt-4 bg-gray-900 text-white py-3 rounded-2xl font-bold hover:bg-gray-800 transition-all text-sm"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-semibold border border-red-100">
                    {error}
                  </div>
                )}

                {/* Subject Code */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Subject Code</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="subjectCode"
                      required
                      placeholder="e.g. CS101, IT214, MATH10"
                      value={formData.subjectCode}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                    />
                  </div>
                </div>

                {/* Class Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Class / Subject Name</label>
                  <div className="relative">
                    <BookOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Data Structures & Algorithms"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Term & Year Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Term / Semester</label>
                    <select
                      name="term"
                      value={formData.term}
                      onChange={handleChange}
                      className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                      <option value="Midyear / Summer">Midyear / Summer</option>
                      <option value="Trimester 1">Trimester 1</option>
                      <option value="Trimester 2">Trimester 2</option>
                      <option value="Trimester 3">Trimester 3</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Academic Year</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <select
                        name="year"
                        required
                        value={formData.year}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      >
                        {buildAcademicYearOptions(formData.year).map((ay) => (
                          <option key={ay} value={ay}>
                            AY {ay}
                            {ay === getCurrentAcademicYear() ? ' (Current)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Description (Optional)</label>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Brief overview or room schedule for this class..."
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-200 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        {isEditing ? 'Saving Changes...' : 'Creating Class & Generating Code...'}
                      </>
                    ) : isEditing ? (
                      'Save Class Changes'
                    ) : (
                      'Create Class'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateClassModal;
