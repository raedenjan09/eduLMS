import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Mail, Calendar, CheckCircle2, 
  XCircle, Award, BookOpen, Clock, AlertCircle, FileText 
} from 'lucide-react';

const StudentDetailModal = ({ isOpen, onClose, student, className, subjectCode }) => {
  if (!isOpen || !student) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-100">
                {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">{student.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <Mail size={13} /> {student.email}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="p-6 border-b border-gray-100 bg-white grid grid-cols-3 gap-4">
            <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100/60">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                Progress
              </span>
              <p className="text-xl font-black text-blue-950 mt-1">
                {student.progressPercent || 0}%
              </p>
              <span className="text-[10px] text-gray-500">
                {student.completedLessonsCount || 0} of {student.totalLessons || 0} Lessons
              </span>
            </div>

            <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100/60">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
                Avg. Quiz Score
              </span>
              <p className={`text-xl font-black mt-1 ${
                (student.averageScore || 0) >= 75 ? 'text-emerald-600' : 'text-purple-950'
              }`}>
                {student.averageScore || 0}%
              </p>
              <span className="text-[10px] text-gray-500">
                {(student.averageScore || 0) >= 75 ? 'Passing average (≥75%)' : 'Needs improvement (<75%)'}
              </span>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Status
              </span>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  student.status === 'Completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : student.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {student.status || 'Enrolled'}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 block mt-1">
                {student.joinedAt ? `Joined ${new Date(student.joinedAt).toLocaleDateString()}` : 'Enrolled'}
              </span>
            </div>
          </div>

          {/* Lesson Breakdown */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">
              Topic & Quiz Breakdown for {subjectCode}
            </h4>

            {!student.lessons || student.lessons.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                No lessons or topics configured yet for this subject.
              </p>
            ) : (
              student.lessons.map((lesson) => (
                <div
                  key={lesson.lessonId}
                  className="p-3.5 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors bg-gray-50/40 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-700 shrink-0">
                      {lesson.order}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-gray-800">{lesson.title}</h5>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                        <span>Slides: {lesson.slidesViewed ? '✓ Viewed' : 'Not Viewed'}</span>
                        <span>•</span>
                        <span>Attempts: {lesson.attempts || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-black text-gray-900 block">
                        {lesson.attempts > 0 ? `${lesson.highestScore}%` : 'No score'}
                      </span>
                      <span className={`text-[10px] font-bold ${
                        lesson.passed ? 'text-emerald-600' : 'text-gray-400'
                      }`}>
                        {lesson.passed ? 'Passed' : 'Pending'}
                      </span>
                    </div>
                    {lesson.passed ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <Clock size={18} className="text-gray-300" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StudentDetailModal;

