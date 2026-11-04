import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Check } from 'lucide-react';

const TermsModal = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 p-2 rounded-xl">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Privacy Policy & Terms of Service</h3>
                <p className="text-xs text-gray-500">Effective Date: November 2026</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-4 text-sm text-gray-600 leading-relaxed">
            <section>
              <h4 className="font-bold text-gray-900 mb-1">1. Acceptance of Terms</h4>
              <p>
                By registering for an account or using EduLMS, you agree to comply with and be legally bound by these Terms and Conditions, our Privacy Policy, and all applicable academic honor codes.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-gray-900 mb-1">2. User Roles & Account Security</h4>
              <p>
                You are responsible for maintaining the confidentiality of your credentials. 
                <strong> Faculty accounts</strong> are authorized to create academic classes, upload instructional presentations, design assessments, and evaluate student records.
                <strong> Student accounts</strong> may join classes via faculty-issued class codes, complete lessons, and submit quizzes.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-gray-900 mb-1">3. Academic Integrity & Grading Policies</h4>
              <p>
                All assessment submissions must represent the student's individual, authentic work. Each topic assessment requires an established minimum passing score of <strong>75%</strong> to verify mastery before sequential lesson progression is unlocked.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-gray-900 mb-1">4. Privacy & Data Protection</h4>
              <p>
                We process your name, institutional email address, assessment outcomes, and class interactions solely for educational delivery and reporting. We do not sell or monetize personal or educational data.
              </p>
            </section>

            <section>
              <h4 className="font-bold text-gray-900 mb-1">5. Content Ownership & Respectful Use</h4>
              <p>
                Instructional slides, uploaded presentations, and quizzes remain the intellectual property of their respective educators and institutions. Users may not distribute or misuse proprietary course materials.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors text-sm"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onAccept) onAccept();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-200 text-sm flex items-center gap-2"
            >
              <Check size={16} />
              I Agree & Accept
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TermsModal;

