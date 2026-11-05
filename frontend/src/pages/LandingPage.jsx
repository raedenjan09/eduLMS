import React from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';

const LandingPage = () => {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Simple Clean Navbar */}
      <nav className="bg-white border-b border-slate-200/80 px-4 sm:px-6 md:px-12 py-3 sm:py-3.5 flex justify-between items-center w-full">
        <Logo size={32} textSize="text-lg sm:text-xl" />

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/login"
            className="text-slate-700 hover:text-blue-600 font-semibold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="bg-slate-900 text-white font-semibold text-xs sm:text-sm px-3.5 sm:px-4.5 py-2 rounded-xl hover:bg-slate-800 transition-all shadow-xs active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Get Started</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col justify-center max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
        {/* Hero Section */}
        <div className="mb-10 sm:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="inline-block px-3 py-1 mb-4 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
              Academic Learning Platform
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4 sm:mb-5">
              Empower Your <span className="text-blue-600">Learning Journey</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-6 sm:mb-8">
              A comprehensive system designed for Students, Faculty, and Administrators to deliver lessons, take assessments, and monitor academic progress effortlessly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/register"
                className="w-full sm:w-auto bg-blue-600 text-white px-7 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Create an Account</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto bg-white text-slate-700 border border-slate-300 px-7 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-xs flex items-center justify-center"
              >
                Sign In to Portal
              </Link>
            </div>
          </motion.div>
        </div>

        {/* 3 Simple Cards — Middle Aligned on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 sm:mb-4">
              <Users size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Student Portal</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enroll in classes using a class code, study lessons sequentially, and complete quizzes to track your scores.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 sm:mb-4">
              <GraduationCap size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Faculty Dashboard</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Create syllabus topics, author or bulk upload assessments, and generate class gradebook summaries.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 sm:mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Admin Control</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manage system users, assign roles, and oversee courses across departments with administrative controls.
            </p>
          </div>
        </div>
      </main>

      {/* Simple Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} EduLMS. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;