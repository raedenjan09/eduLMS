import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, KeyRound, CheckCircle, Loader2 } from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const JoinClassModal = ({ isOpen, onClose, onClassJoined }) => {
  const toast = useToast();
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classCode.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await API.post('/classes/join', {
        classCode: classCode.trim().toUpperCase(),
      });
      setSuccess(data.message || 'Successfully joined class!');
      toast.success(
        data.classData?.name
          ? `You are now enrolled in "${data.classData.subjectCode} — ${data.classData.name}".`
          : data.message || 'Successfully joined class!',
        'Class Joined'
      );
      if (onClassJoined) onClassJoined(data.classData);
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join class. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClassCode('');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-2xl text-white">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Join a Class</h3>
                <p className="text-xs text-gray-500">Enter the unique code provided by your teacher</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <div className="p-6">
            {success ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={30} />
                </div>
                <h4 className="text-lg font-bold text-gray-900">{success}</h4>
                <p className="text-xs text-gray-500">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-semibold border border-red-100">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">
                    Class Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. 9B3A7F"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl text-center text-2xl font-black font-mono tracking-widest text-indigo-900 focus:outline-none focus:border-indigo-600 focus:bg-white uppercase placeholder:text-gray-300"
                  />
                  <p className="text-[11px] text-gray-400 mt-2 text-center">
                    Note: This is the 6-character class code, distinct from the Subject Code (e.g. CS101).
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !classCode.trim()}
                    className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all text-sm shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Verifying Code...
                      </>
                    ) : (
                      'Join Class Now'
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

export default JoinClassModal;

