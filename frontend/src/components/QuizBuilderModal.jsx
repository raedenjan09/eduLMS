import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, HelpCircle, Plus, Trash2, CheckCircle2, 
  Upload, FileSpreadsheet, Sparkles, AlertCircle, Loader2, Download, FileText
} from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const QuizBuilderModal = ({ isOpen, onClose, lessonId, classId, lessonTitle, onQuizSaved }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'bulk' | 'templates'
  const [quizTitle, setQuizTitle] = useState('');
  const [passingScore, setPassingScore] = useState(75);
  const [timeLimit, setTimeLimit] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [bulkText, setBulkText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && lessonId) {
      loadExistingQuiz();
    }
  }, [isOpen, lessonId]);

  const loadExistingQuiz = async () => {
    setFetching(true);
    setError('');
    try {
      const { data } = await API.get(`/quizzes/lesson/${lessonId}`);
      if (data && data.exists !== false && data.questions) {
        setQuizTitle(data.title || `Quiz: ${lessonTitle}`);
        setPassingScore(data.passingScore || 75);
        setTimeLimit(data.timeLimit || 0);
        setShuffleQuestions(data.shuffleQuestions !== false);
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          initEmptyQuestions();
        }
      } else {
        setQuizTitle(`Quiz: ${lessonTitle}`);
        setPassingScore(75);
        setTimeLimit(0);
        setShuffleQuestions(true);
        initEmptyQuestions();
      }
    } catch {
      // No quiz exists yet; initialize default title and starter template
      setQuizTitle(`Quiz: ${lessonTitle}`);
      setPassingScore(75);
      setTimeLimit(0);
      setShuffleQuestions(true);
      initEmptyQuestions();
    } finally {
      setFetching(false);
    }
  };

  const initEmptyQuestions = () => {
    // Initialize with 10 question skeletons to guide faculty toward meeting the 10 minimum requirement
    const starter = Array.from({ length: 10 }, (_, i) => ({
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
    }));
    setQuestions(starter);
  };

  const handleQuestionChange = (qIndex, field, value) => {
    const updated = [...questions];
    updated[qIndex][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  const addQuestion = () => {
    if (questions.length >= 20) {
      setError('A maximum of 20 questions is allowed per quiz.');
      return;
    }
    setQuestions([
      ...questions,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: '',
      },
    ]);
  };

  const removeQuestion = (qIndex) => {
    if (questions.length <= 10) {
      setError('A minimum of 10 questions is required per quiz. You cannot delete below 10.');
      return;
    }
    const updated = questions.filter((_, idx) => idx !== qIndex);
    setQuestions(updated);
  };

  // Bulk CSV parser
  const handleBulkParse = async (rawContentOverride) => {
    const textToParse = typeof rawContentOverride === 'string' ? rawContentOverride : bulkText;
    if (!textToParse.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/quizzes/bulk-parse', { rawText: textToParse });
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions.slice(0, 20));
        setActiveTab('manual');
        setSuccess(`Successfully imported ${Math.min(data.questions.length, 20)} questions!`);
        toast.success(
          `Imported ${Math.min(data.questions.length, 20)} questions into the assessment builder.`,
          'Questions Imported'
        );
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to parse questions.');
    } finally {
      setLoading(false);
    }
  };

  // Handle direct .csv / .txt file upload
  const handleBulkFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadedFileName(file.name);
    try {
      const text = await file.text();
      setBulkText(text);
      toast.info(`Loaded "${file.name}". Parsing questions...`, 'File Loaded');
      await handleBulkParse(text);
    } catch {
      setError('Could not read the selected file. Please upload a valid .csv or .txt file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Download sample 10-question CSV template for Excel / Google Sheets
  const handleDownloadCsvTemplate = () => {
    const sampleTopic = (lessonTitle || 'Course Topic').replace(/"/g, '""');
    const csvRows = [
      'Question,Option A,Option B,Option C,Option D,Correct Answer (A/B/C/D),Explanation',
      `"What is the primary objective of studying ${sampleTopic}?","To establish foundational conceptual and practical understanding","To bypass foundational theory entirely","To eliminate the need for systematic testing","To restrict system scalability",A,"Understanding core concepts ensures proper application in real-world scenarios."`,
      `"Which approach best demonstrates mastery of ${sampleTopic}?","Applying structured principles to solve practical problems","Memorizing terms without context","Ignoring edge-case validation","Skipping documentation steps",A,"Practical problem-solving reflects true comprehension."`,
      `"In the context of ${sampleTopic}, why is standardization important?","It ensures consistency, maintainability, and interoperability","It increases unnecessary complexity","It prevents team collaboration","It slows down execution speed",A,"Standardization allows teams and systems to work together reliably."`,
      `"What is a common pitfall when implementing concepts from ${sampleTopic}?","Overlooking foundational requirements before scaling","Testing components thoroughly","Documenting architectural decisions","Reviewing peer implementations",A,"Skipping requirements analysis often leads to rework."`,
      `"Which metric best evaluates the effectiveness of a solution in ${sampleTopic}?","Accuracy, reliability, and adherence to specifications","Total lines of documentation written","Number of tools installed","Visual complexity of the workflow",A,"Solutions are measured by reliability and requirement alignment."`,
      `"How should exceptions or unexpected inputs be handled in ${sampleTopic}?","Through structured validation and graceful error handling","By ignoring invalid states","By terminating the system without logs","By hardcoding temporary workarounds",A,"Graceful validation protects system integrity."`,
      `"What role does iterative review play when working with ${sampleTopic}?","It identifies defects early and refines overall quality","It replaces initial planning completely","It is only needed after deployment","It reduces code readability",A,"Continuous review catches issues when they are easiest to fix."`,
      `"When optimizing a workflow related to ${sampleTopic}, what should come first?","Measuring and identifying the actual bottleneck","Rewriting the entire system from scratch","Removing validation checks","Adding redundant processing layers",A,"Optimization should always be guided by actual measurements."`,
      `"Which practice supports long-term maintainability in ${sampleTopic}?","Clear modular design and comprehensive documentation","Combining all logic into a single monolithic block","Using ambiguous naming conventions","Avoiding version control",A,"Modularity makes future updates safe and predictable."`,
      `"What is the recommended final step after completing a task in ${sampleTopic}?","Verifying outputs against expected test criteria","Deploying immediately without verification","Deleting test cases","Skipping user acceptance checks",A,"Verification confirms that all objectives have been met."`
    ];
    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Assessment_Questions_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info('Downloaded 10-question CSV template.', 'Template Downloaded');
  };

  // Load sample 10-question template
  const loadSampleQuestions = () => {
    const sampleTopic = lessonTitle || 'Lesson Topics';
    const samples = [
      {
        questionText: `What is the primary objective of studying ${sampleTopic}?`,
        options: [
          'To establish foundational conceptual and practical understanding',
          'To bypass foundational theory entirely',
          'To eliminate the need for systematic testing',
          'None of the above',
        ],
        correctAnswer: 0,
        explanation: 'Foundational concepts guide reliable application.',
      },
      {
        questionText: 'Which principle emphasizes modularity in design?',
        options: [
          'High coupling and monolithic architecture',
          'Separation of concerns into decoupled components',
          'Duplicating business logic across modules',
          'Ignoring interface contracts',
        ],
        correctAnswer: 1,
        explanation: 'Separation of concerns enhances maintainability.',
      },
      {
        questionText: 'What is the required passing score for assessments in this LMS?',
        options: ['50%', '60%', '75%', '90%'],
        correctAnswer: 2,
        explanation: 'A 75% score demonstrates sequential mastery.',
      },
      {
        questionText: 'What happens when a student scores below 75%?',
        options: [
          'They proceed immediately without restrictions',
          'Progression is locked until they retake and achieve >= 75%',
          'The account is permanently disabled',
          'The lesson is skipped',
        ],
        correctAnswer: 1,
        explanation: 'Prerequisites must be passed with at least 75%.',
      },
      {
        questionText: 'How is data integrity verified in distributed systems?',
        options: [
          'Through cryptographic hashing and consensus validation',
          'By assuming network transmission is always lossless',
          'By removing validation checks',
          'Through random sampling without verification',
        ],
        correctAnswer: 0,
        explanation: 'Hashes confirm message payloads remain untampered.',
      },
      {
        questionText: 'Which format is standard for exchanging structured web data?',
        options: ['JSON', 'Raw binary dumps without schema', 'Unstructured text', 'Bitmap audio'],
        correctAnswer: 0,
        explanation: 'JSON is lightweight, universally parsed, and standard.',
      },
      {
        questionText: 'What is the benefit of sequential lesson locking?',
        options: [
          'Guarantees required prerequisite knowledge before advanced topics',
          'Prevents students from studying',
          'Slows down instructional delivery unnecessarily',
          'Removes faculty oversight',
        ],
        correctAnswer: 0,
        explanation: 'Sequential learning ensures topics build upon mastered concepts.',
      },
      {
        questionText: 'Which HTTP method is conventionally used for state-modifying submissions?',
        options: ['GET', 'POST', 'OPTIONS', 'HEAD'],
        correctAnswer: 1,
        explanation: 'POST represents form and assessment submissions.',
      },
      {
        questionText: 'What is the role of an educator in the evaluation cycle?',
        options: [
          'Monitoring student performance and guiding mastery',
          'Ignoring assessment metrics',
          'Refusing feedback on attempts',
          'Preventing quiz retakes entirely',
        ],
        correctAnswer: 0,
        explanation: 'Reports and metrics help instructors tailor support.',
      },
      {
        questionText: 'Which document format is optimal for official academic reports?',
        options: ['PDF / Printable Spreadsheet', 'Unformatted clipboard snippet', 'Temporary session cache', 'Single-character text'],
        correctAnswer: 0,
        explanation: 'PDF and spreadsheets provide persistent, auditable grade records.',
      },
    ];

    setQuestions(samples);
    setActiveTab('manual');
    setSuccess('10-Question Starter Template loaded! You can now customize each question.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!quizTitle.trim()) {
      setError('Please provide a quiz title.');
      return;
    }

    if (questions.length < 10 || questions.length > 20) {
      setError(`A quiz must contain between 10 and 20 questions. Current count: ${questions.length}.`);
      return;
    }

    // Validate that questions are filled in
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setError(`Question #${i + 1} has empty question text.`);
        return;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          setError(`Question #${i + 1}, Option ${String.fromCharCode(65 + j)} is empty.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        classId,
        lessonId,
        title: quizTitle.trim(),
        passingScore: Number(passingScore) || 75,
        timeLimit: Math.max(0, Number(timeLimit) || 0),
        shuffleQuestions,
        questions,
      };

      const { data } = await API.post('/quizzes', payload);
      setSuccess('Quiz saved successfully!');
      toast.success(
        `Assessment "${quizTitle.trim()}" (${questions.length} questions) saved.`,
        'Assessment Saved'
      );
      if (onQuizSaved) onQuizSaved(data.quiz);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save quiz.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600 p-2.5 rounded-2xl text-white">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Quiz Assessment Builder</h3>
                <p className="text-xs text-gray-500">
                  Topic: <span className="font-semibold text-gray-700">{lessonTitle}</span> (Requires 10 to 20 questions, 75% passing mark)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Bar / Mode Tabs */}
          <div className="px-6 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('manual')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'manual'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Interactive Builder ({questions.length}/20)
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'bulk'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileSpreadsheet size={15} />
                Bulk CSV / Text Upload
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'templates'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Sparkles size={15} />
                Sample Templates
              </button>
            </div>

            {/* Questions Counter Badge */}
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
              questions.length >= 10 && questions.length <= 20
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {questions.length >= 10 && questions.length <= 20 ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
              <span>{questions.length} Questions (Min 10, Max 20)</span>
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mx-6 mt-3 p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-2xl border border-red-100 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mx-6 mt-3 p-3 bg-green-50 text-green-700 text-xs font-semibold rounded-2xl border border-green-100 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Body Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {fetching ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                <Loader2 className="animate-spin" size={28} />
                <span className="text-sm font-medium">Loading Quiz Details...</span>
              </div>
            ) : activeTab === 'manual' ? (
              <div className="space-y-6">
                {/* Quiz Info */}
                <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Quiz Title</label>
                      <input
                        type="text"
                        value={quizTitle}
                        onChange={(e) => setQuizTitle(e.target.value)}
                        placeholder="e.g. Topic 1 Mastery Assessment"
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Passing Grade (%)</label>
                      <input
                        type="number"
                        min={75}
                        max={100}
                        value={passingScore}
                        onChange={(e) => setPassingScore(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Time Limit (Minutes)</label>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Math.max(0, Number(e.target.value)))}
                        placeholder="0 = Untimed"
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                      <span className="text-[10px] text-gray-400 ml-1">0 = No time limit</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200/70">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        Shuffle Questions & Answer Choices on Retakes
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Randomizes question order and options (A, B, C, D) on each student attempt to prevent memorization
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="h-4 w-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-5">
                  {questions.map((q, qIndex) => (
                    <div
                      key={qIndex}
                      className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-purple-700 uppercase tracking-wider bg-purple-50 px-2.5 py-1 rounded-lg">
                          Question #{qIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          title="Delete question"
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Question Text */}
                      <div className="mb-4">
                        <input
                          type="text"
                          value={q.questionText}
                          onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                          placeholder={`Enter Question #${qIndex + 1}...`}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                      </div>

                      {/* 4 Choices */}
                      <div className="space-y-2 mb-3">
                        <span className="text-[11px] font-bold text-gray-500 block">
                          Choices (Select the radio button next to the CORRECT answer):
                        </span>
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              checked={q.correctAnswer === optIndex}
                              onChange={() => handleQuestionChange(qIndex, 'correctAnswer', optIndex)}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-gray-400 w-5">
                              {String.fromCharCode(65 + optIndex)}.
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Optional Explanation */}
                      <div>
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                          placeholder="Explanation / feedback shown after grading (optional)..."
                          className="w-full px-3 py-1.5 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl text-xs text-gray-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Question Button */}
                {questions.length < 20 && (
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full py-3.5 border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 rounded-2xl text-purple-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                  >
                    <Plus size={18} />
                    Add Question ({questions.length + 1} of 20)
                  </button>
                )}
              </div>
            ) : activeTab === 'bulk' ? (
              /* Bulk Upload Tab */
              <div className="space-y-4">
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl text-xs text-purple-900 leading-relaxed">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-sm">CSV / Spreadsheet Bulk Upload</h4>
                    <button
                      type="button"
                      onClick={handleDownloadCsvTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs transition-all shadow-sm"
                    >
                      <Download size={13} />
                      Download .CSV Template
                    </button>
                  </div>
                  <p>
                    Upload a <strong>.csv</strong> or <strong>.txt</strong> file directly from Excel / Google Sheets, or paste rows below using this column order:
                  </p>
                  <code className="block bg-white p-2.5 rounded-xl border border-purple-200 mt-2 font-mono text-[11px] text-purple-800">
                    Question Text, Option A, Option B, Option C, Option D, CorrectAnswerLetter (A/B/C/D), OptionalExplanation
                  </code>
                </div>

                {/* Direct File Upload Dropzone / Picker */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-gray-50/80 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-2xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Upload a .CSV or .TXT Question Bank File'}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Automatically parses and imports up to 20 questions into the interactive builder
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={handleBulkFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <Upload size={14} />
                    Choose .CSV / .TXT File
                  </button>
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-gray-200" />
                  <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Or Paste CSV / Spreadsheet Rows Below
                  </span>
                  <div className="flex-grow border-t border-gray-200" />
                </div>

                <textarea
                  rows={8}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="What is CPU?, Central Processing Unit, Computer Part Unit, Core Power Unit, None, A, CPU handles computing.&#10;What is RAM?, Random Access Memory, Read All Memory, Rapid Access Module, None, A"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />

                <button
                  type="button"
                  onClick={() => handleBulkParse()}
                  disabled={loading || !bulkText.trim()}
                  className="w-full py-3 rounded-2xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-all shadow-md shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Parsing Questions...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Parse & Import Questions into Builder
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Sample Templates Tab */
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl">
                  <h4 className="font-bold text-base text-gray-900 mb-1">10-Question Standard Assessment Template</h4>
                  <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                    Instantly load a curated 10-question assessment structure that satisfies the LMS minimum requirement. You can preview, edit, or adjust every question and answer in the interactive builder before publishing.
                  </p>
                  <button
                    type="button"
                    onClick={loadSampleQuestions}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-md shadow-purple-200 flex items-center gap-2"
                  >
                    <Sparkles size={15} />
                    Load 10-Question Template Now
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Passing requirement: <strong>{passingScore}%</strong> (Students with &lt; 75% cannot proceed to next topic)
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || questions.length < 10 || questions.length > 20}
                className="px-6 py-2.5 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-md shadow-purple-200 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Saving Quiz...
                  </>
                ) : (
                  'Save & Publish Quiz'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QuizBuilderModal;

