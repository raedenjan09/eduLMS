import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, HelpCircle, Plus, Trash2, CheckCircle2, 
  Upload, FileSpreadsheet, Sparkles, AlertCircle, Loader2, Download, FileText,
  Bot, Layers, Settings2, Key, Check, ChevronDown, ChevronUp, FileUp, Presentation
} from 'lucide-react';
import axios from 'axios';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { isPdfArrayBuffer, extractTextFromPptx, extractTextFromPdf } from '../utils/presentationParser';

const QuizBuilderModal = ({ isOpen, onClose, lessonId, classId, lessonTitle, onQuizSaved }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const aiFileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'ai' | 'bulk'
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

  // AI Assistant States (Google Gemini 1.5 Flash)
  const [lessonData, setLessonData] = useState(null);
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiCustomText, setAiCustomText] = useState('');
  const [aiCustomApiKey, setAiCustomApiKey] = useState(
    () => localStorage.getItem('lms_gemini_api_key') || localStorage.getItem('lms_ai_api_key') || ''
  );
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiScanStep, setAiScanStep] = useState('');
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState([]);
  const [aiUploadedFile, setAiUploadedFile] = useState(null);

  useEffect(() => {
    if (isOpen && lessonId) {
      loadExistingQuiz();
      loadLessonInfo();
      setAiGeneratedQuestions([]);
      setAiUploadedFile(null);
    }
  }, [isOpen, lessonId]);

  const loadLessonInfo = async () => {
    try {
      const { data } = await API.get(`/lessons/${lessonId}`);
      setLessonData(data);
    } catch (err) {
      console.warn('Could not load lesson details for AI builder', err);
    }
  };

  const loadExistingQuiz = async () => {
    setFetching(true);
    setError('');
    try {
      const { data } = await API.get(`/quizzes/lesson/${lessonId}`);
      if (data && data.exists !== false && data.questions) {
        setQuizTitle(data.title || `Quiz: ${lessonTitle}`);
        setPassingScore(data.passingScore || 75);
        setTimeLimit(data.timeLimit !== undefined ? data.timeLimit : 0);
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

  const handleGenerateWithAI = async () => {
    setError('');
    setAiScanning(true);
    setAiScanStep('Scanning presentation materials...');

    try {
      let contentText = aiCustomText.trim();

      // 1. If faculty selected a custom PPT/PDF directly in the modal
      if (aiUploadedFile) {
        setAiScanStep(`Reading ${aiUploadedFile.name}...`);
        const buffer = await aiUploadedFile.arrayBuffer();
        if (aiUploadedFile.name.toLowerCase().endsWith('.pdf') || isPdfArrayBuffer(buffer)) {
          setAiScanStep('Extracting text from PDF presentation...');
          const extracted = await extractTextFromPdf(buffer);
          contentText = (contentText ? contentText + '\n\n' : '') + extracted;
        } else {
          setAiScanStep('Extracting slides & text from PowerPoint (.pptx)...');
          const extracted = await extractTextFromPptx(buffer);
          contentText = (contentText ? contentText + '\n\n' : '') + extracted;
        }
      } else if (!contentText && lessonData) {
        // 2. Scan the lesson's attached file if present
        const attachment = lessonData.attachments?.[0];
        if (attachment && attachment.fileUrl) {
          setAiScanStep(`Scanning ${attachment.fileName}...`);
          try {
            const resp = await axios.get(attachment.fileUrl, { responseType: 'arraybuffer' });
            const buffer = resp.data;
            if (attachment.fileName.toLowerCase().endsWith('.pdf') || isPdfArrayBuffer(buffer)) {
              setAiScanStep('Extracting text from PDF slides...');
              const extracted = await extractTextFromPdf(buffer);
              contentText = (contentText ? contentText + '\n\n' : '') + extracted;
            } else {
              setAiScanStep('Extracting text from PowerPoint deck (.pptx)...');
              const extracted = await extractTextFromPptx(buffer);
              contentText = (contentText ? contentText + '\n\n' : '') + extracted;
            }
          } catch (fetchErr) {
            console.warn('Could not extract file directly on client, sending to backend fallback:', fetchErr);
          }
        } else if (lessonData.slides?.length > 0) {
          // 3. Scan interactive built-in slides
          setAiScanStep(`Reading ${lessonData.slides.length} interactive slides...`);
          contentText = lessonData.slides
            .map(
              (s, i) =>
                `Slide ${i + 1}: ${s.title || ''}\n${s.content || ''}\n${(s.bullets || []).join('\n')}`
            )
            .join('\n\n');
          if (lessonData.summary) {
            contentText += `\n\nLesson Summary:\n${lessonData.summary}`;
          }
        }
      }

      setAiScanStep('Google Gemini is scanning presentation slides & formulating assessment questions...');

      const payload = {
        lessonId,
        contentText,
        questionCount: aiQuestionCount,
        difficulty: aiDifficulty,
        apiKey: aiCustomApiKey.trim() || undefined,
      };

      if (aiCustomApiKey.trim()) {
        localStorage.setItem('lms_gemini_api_key', aiCustomApiKey.trim());
      }

      const { data } = await API.post('/quizzes/generate-ai', payload);

      if (data?.questions && data.questions.length >= 10) {
        setAiGeneratedQuestions(data.questions);
        toast.success(
          `Generated ${data.questions.length} assessment questions from the presentation!`,
          'Assessment Ready'
        );
        if (data.warning) {
          console.info('AI generator notice:', data.warning);
        }
      } else {
        setError('AI could not generate enough questions. Please ensure the presentation has readable slide content.');
      }
    } catch (err) {
      console.error('AI quiz generation error:', err);
      setError(
        err.response?.data?.message ||
          'Failed to generate questions. Please ensure the file has text or paste notes below.'
      );
    } finally {
      setAiScanning(false);
      setAiScanStep('');
    }
  };

  const handleApplyAiQuestions = () => {
    if (!aiGeneratedQuestions || aiGeneratedQuestions.length === 0) return;
    setQuestions(aiGeneratedQuestions);
    setActiveTab('manual');
    toast.success(
      `Applied ${aiGeneratedQuestions.length} AI-generated questions into the quiz builder! You can review or tweak them.`,
      'Questions Applied'
    );
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
          <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex flex-wrap sm:flex-nowrap gap-2 overflow-x-auto pb-1 sm:pb-0 w-full md:w-auto">
              <button
                onClick={() => setActiveTab('manual')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'manual'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Interactive Builder ({questions.length}/20)
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'ai'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200 ring-2 ring-purple-300'
                    : 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 hover:bg-purple-100 border border-purple-200/70'
                }`}
              >
                <Bot size={15} className={activeTab === 'ai' ? 'text-white' : 'text-purple-600'} />
                <span>✨ AI Assistant (Scan Slides)</span>
                {aiGeneratedQuestions.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-green-500 text-white rounded-full font-bold">
                    {aiGeneratedQuestions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'bulk'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileSpreadsheet size={15} />
                Bulk CSV / Text Upload
              </button>
            </div>

            {/* Questions Counter Badge */}
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 ${
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
                      <span className="text-[10px] text-gray-400 ml-1">0 = Untimed. Enter minutes (e.g. 30) for real-time timer.</span>
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
            ) : activeTab === 'ai' ? (
              /* AI Assistant Tab */
              <div className="space-y-6">
                {/* Intro Card */}
                <div className="p-5 bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100/50 border border-purple-100 rounded-3xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200 shrink-0">
                        <Bot size={22} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                          AI Assessment Generator
                        </h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Automatically scan lecture slides (.pptx) or presentation documents (.pdf) to construct comprehensive 10–20 question assessments with complete answer keys and explanations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detected Presentation Material */}
                <div className="p-5 bg-white border border-gray-200/80 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Presentation size={15} className="text-purple-600" />
                      Presentation Source Material
                    </label>
                    <span className="text-[11px] font-semibold text-gray-400">
                      Supports .pptx and .pdf
                    </span>
                  </div>

                  {/* Attached Lesson Deck Banner if present */}
                  {lessonData?.attachments?.[0] && !aiUploadedFile && (
                    <div className="p-3.5 bg-purple-50/70 border border-purple-200/70 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                          <Presentation size={18} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                            Attached Lesson Deck Detected
                          </span>
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {lessonData.attachments[0].fileName}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full shrink-0">
                        Auto-detected
                      </span>
                    </div>
                  )}

                  {/* Interactive Slides Banner if present */}
                  {!lessonData?.attachments?.[0] && lessonData?.slides?.length > 0 && !aiUploadedFile && (
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/70 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                            Interactive Slide Deck Detected
                          </span>
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {lessonData.slides.length} slides with lecture content
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full shrink-0">
                        {lessonData.slides.length} Slides
                      </span>
                    </div>
                  )}

                  {/* Upload Custom / New File Picker */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-gray-50/80 border-2 border-dashed border-purple-200 hover:border-purple-300 rounded-2xl transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <FileUp size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {aiUploadedFile ? `Selected: ${aiUploadedFile.name}` : 'Upload or Drag & Drop PPTX / PDF'}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {aiUploadedFile
                            ? `${(aiUploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to scan`
                            : 'Scan custom lecture slides or presentation file'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {aiUploadedFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setAiUploadedFile(null);
                            if (aiFileInputRef.current) aiFileInputRef.current.value = '';
                          }}
                          className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      <input
                        ref={aiFileInputRef}
                        type="file"
                        accept=".pptx,.pdf,.ppt"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setAiUploadedFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => aiFileInputRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Upload size={14} />
                        {aiUploadedFile ? 'Change File' : 'Choose Presentation'}
                      </button>
                    </div>
                  </div>

                  {/* Optional Extra Notes or Excerpt */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Additional Study Notes / Excerpts (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={aiCustomText}
                      onChange={(e) => setAiCustomText(e.target.value)}
                      placeholder="Paste additional key concepts, textbook summaries, or specific formulas you want the AI to include in the quiz..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Generator Settings */}
                <div className="p-5 bg-white border border-gray-200/80 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Settings2 size={15} className="text-purple-600" />
                      Assessment Parameters
                    </label>
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                      Standard Multiple Choice (4 Choices)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Question Count Selection */}
                    <div>
                      <span className="block text-xs font-bold text-gray-700 mb-2">
                        Questions to Generate (Min 10, Max 20)
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {[10, 15, 20].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setAiQuestionCount(num)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              aiQuestionCount === num
                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {num} Questions
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty Selection */}
                    <div>
                      <span className="block text-xs font-bold text-gray-700 mb-2">
                        Cognitive Depth / Difficulty
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'easy', label: 'Foundational' },
                          { id: 'medium', label: 'Balanced' },
                          { id: 'hard', label: 'Advanced' },
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setAiDifficulty(d.id)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              aiDifficulty === d.id
                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scan Action / Progress Button */}
                {aiScanning ? (
                  <div className="p-6 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                    <Loader2 className="animate-spin text-purple-600" size={32} />
                    <div>
                      <p className="text-sm font-bold text-purple-900">{aiScanStep || 'Analyzing presentation materials...'}</p>
                      <p className="text-xs text-purple-700 mt-0.5">Formulating 4-choice questions, answer keys, and academic explanations...</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateWithAI}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-sm hover:from-purple-700 hover:to-indigo-800 transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                  >
                    <Bot size={18} />
                    <span>✨ Scan Presentation & Generate Assessment ({aiQuestionCount} Questions)</span>
                  </button>
                )}

                {/* Generated Questions Preview Card */}
                {aiGeneratedQuestions.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-emerald-900">
                            {aiGeneratedQuestions.length} Questions Generated Successfully!
                          </h4>
                          <p className="text-xs text-emerald-700">
                            Each question features 4 choices, a verified answer key, and an explanation.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyAiQuestions}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <Check size={14} />
                        Apply All Questions to Builder
                      </button>
                    </div>

                    {/* Preview Cards List */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block ml-1">
                        AI Generated Questions Preview ({aiGeneratedQuestions.length})
                      </span>
                      {aiGeneratedQuestions.map((q, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-sm hover:border-purple-200 transition-all"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <h5 className="font-bold text-xs text-gray-900 leading-snug">
                                {q.questionText}
                              </h5>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = oIdx === q.correctAnswer;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                      : 'bg-gray-50/70 border-gray-200 text-gray-600'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <span className="truncate">{opt}</span>
                                  {isCorrect && (
                                    <Check size={12} className="text-emerald-600 ml-auto shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="pl-8 pt-1 text-[11px] text-gray-500 italic">
                              <strong className="text-purple-700 font-semibold">Explanation: </strong>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
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

