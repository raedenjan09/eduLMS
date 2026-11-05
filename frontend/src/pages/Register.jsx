import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, GraduationCap, Briefcase, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TermsModal from '../components/TermsModal';
import Logo from '../components/Logo';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    termsAccepted: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.termsAccepted) {
      setError('You must accept the Privacy Terms & Conditions to create an account.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await register(
        formData.name,
        formData.email,
        formData.password,
        formData.role,
        formData.termsAccepted
      );
      toast.success(`Welcome to EduLMS, ${data.name || formData.name}!`, 'Account Created');

      // Redirect based on role
      if (data.role === 'faculty') {
        navigate('/faculty');
      } else if (data.role === 'student') {
        navigate('/student');
      } else if (data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check the fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC] px-4 py-12 md:py-20 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-60"></div>
      </div>

      {/* Back to Home */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-6 left-6 md:top-10 md:left-10"
      >
        <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-semibold group">
          <div className="p-2 rounded-full bg-white shadow-sm border border-gray-100 group-hover:shadow-md transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="hidden sm:inline">Back to Home</span>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[500px] w-full"
      >
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
          <div className="p-8 md:p-10">
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center mb-5"
              >
                <Logo size={46} showText={false} href="" />
              </motion.div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Create Account</h2>
              <p className="text-gray-500 mt-2 font-medium text-xs">Join as a Student or Faculty member</p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-semibold flex items-center border border-red-100 gap-3"
              >
                <div className="h-2 w-2 rounded-full bg-red-600" />
                <span className="flex-1">{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selection Toggle */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">
                  I want to join as
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('student')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${formData.role === 'student'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-900'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    <div className={`p-2 rounded-xl ${formData.role === 'student' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Student</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleSelect('faculty')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${formData.role === 'faculty'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-900'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    <div className={`p-2 rounded-xl ${formData.role === 'faculty' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      <Briefcase size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Faculty</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Full Name</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors h-5 w-5" />
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 outline-none transition-all text-gray-700 font-medium placeholder:text-gray-400 text-sm"
                    placeholder="Prof. John Doe / Jane Doe"
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors h-5 w-5" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 outline-none transition-all text-gray-700 font-medium placeholder:text-gray-400 text-sm"
                    placeholder="user@university.edu"
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors h-5 w-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={8}
                    value={formData.password}
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 outline-none transition-all text-gray-700 font-medium placeholder:text-gray-400 text-sm"
                    placeholder="••••••••"
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 ml-1">
                  Min 8 chars, 1 uppercase, 1 lowercase, 1 number.
                </p>
              </div>

              {/* Privacy Terms & Conditions Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 bg-gray-50/70 border border-gray-200/80 rounded-2xl cursor-pointer hover:bg-gray-100/50 transition-colors">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 leading-tight">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                      className="text-blue-600 font-bold underline hover:text-blue-800"
                    >
                      Privacy Terms and Conditions
                    </button>
                  </span>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold hover:bg-gray-800 transition-all transform active:scale-[0.98] shadow-lg shadow-gray-200 mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Creating Account...
                  </>
                ) : `Register as ${formData.role === 'faculty' ? 'Faculty' : 'Student'}`}
              </button>
            </form>

            <div className="mt-8 text-center text-sm font-medium text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-bold hover:text-blue-700 transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400 font-medium">
          &copy; 2026 EduLMS. All rights reserved.
        </p>
      </motion.div>

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setFormData(prev => ({ ...prev, termsAccepted: true }))}
      />
    </div>
  );
};

export default Register;
