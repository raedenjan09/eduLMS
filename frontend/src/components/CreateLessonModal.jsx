import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, BookOpen, Plus, Trash2, Upload,
  Presentation, CheckCircle2, AlertCircle, Loader2, Link2, Sparkles, RefreshCw,
  ChevronLeft, ChevronRight, Image as ImageIcon, MoveLeft, MoveRight
} from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const CreateLessonModal = ({ isOpen, onClose, classId, lessonToEdit, nextTopicNumber = 1, onLessonSaved }) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [presentationType, setPresentationType] = useState('upload'); // 'upload' | 'create'
  const [uploadedPresentation, setUploadedPresentation] = useState(null);
  const [slides, setSlides] = useState([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [slideImageUploading, setSlideImageUploading] = useState(false);
  const [isDraggingSlideImage, setIsDraggingSlideImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (lessonToEdit) {
        setTitle(lessonToEdit.title || '');
        setSummary(lessonToEdit.summary || '');
        const existingFile = lessonToEdit.attachments?.[0] || null;
        const existingSlides =
          lessonToEdit.slides?.length > 0
            ? lessonToEdit.slides
            : [
                {
                  slideNumber: 1,
                  title: 'Introduction & Learning Objectives',
                  content: '',
                  bullets: ['Key concept overview', 'Core principles'],
                  imageUrl: '',
                },
              ];
        setUploadedPresentation(existingFile);
        setSlides(existingSlides);
        setActiveSlideIdx(0);

        const initialMode =
          lessonToEdit.presentationType === 'create' ||
          (lessonToEdit.presentationType !== 'upload' && lessonToEdit.slides?.length > 0 && !existingFile)
            ? 'create'
            : 'upload';
        setPresentationType(initialMode);
      } else {
        setTitle('');
        setSummary('');
        setUploadedPresentation(null);
        setSlides([
          {
            slideNumber: 1,
            title: 'Introduction & Learning Objectives',
            content: '',
            bullets: ['Key concept overview', 'Core principles'],
            imageUrl: '',
          },
        ]);
        setActiveSlideIdx(0);
        setPresentationType('upload');
      }
      setError('');
    }
  }, [isOpen, lessonToEdit]);

  const handleSelectMode = (mode) => {
    setPresentationType(mode);
    setError('');
    if (mode === 'create' && slides.length === 0) {
      setSlides([
        {
          slideNumber: 1,
          title: 'Introduction & Learning Objectives',
          content: '',
          bullets: ['Key concept overview', 'Core principles'],
          imageUrl: '',
        },
      ]);
      setActiveSlideIdx(0);
    }
  };

  const addSlide = () => {
    const nextNum = slides.length + 1;
    const updated = [
      ...slides,
      {
        slideNumber: nextNum,
        title: `Slide ${nextNum} Title`,
        content: '',
        bullets: ['Key takeaway'],
        imageUrl: '',
      },
    ];
    setSlides(updated);
    setActiveSlideIdx(updated.length - 1);
  };

  const removeSlide = (idx) => {
    if (slides.length <= 1) return;
    const updated = slides
      .filter((_, i) => i !== idx)
      .map((s, i) => ({
        ...s,
        slideNumber: i + 1,
      }));
    setSlides(updated);
    setActiveSlideIdx((prev) => Math.min(prev, updated.length - 1));
  };

  const handleSlideChange = (idx, field, value) => {
    const updated = [...slides];
    updated[idx] = { ...updated[idx], [field]: value };
    setSlides(updated);
  };

  const handleBulletChange = (slideIdx, bulletIdx, value) => {
    const updated = [...slides];
    const bullets = [...(updated[slideIdx].bullets || [])];
    bullets[bulletIdx] = value;
    updated[slideIdx] = { ...updated[slideIdx], bullets };
    setSlides(updated);
  };

  const addBullet = (slideIdx) => {
    const updated = [...slides];
    const bullets = [...(updated[slideIdx].bullets || []), ''];
    updated[slideIdx] = { ...updated[slideIdx], bullets };
    setSlides(updated);
  };

  const removeBullet = (slideIdx, bulletIdx) => {
    const updated = [...slides];
    const bullets = (updated[slideIdx].bullets || []).filter((_, i) => i !== bulletIdx);
    updated[slideIdx] = { ...updated[slideIdx], bullets };
    setSlides(updated);
  };

  const moveSlide = (idx, direction) => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    const updated = [...slides];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    const reindexed = updated.map((s, i) => ({ ...s, slideNumber: i + 1 }));
    setSlides(reindexed);
    setActiveSlideIdx(targetIdx);
  };

  const handleSlideImageUpload = async (file, slideIdx) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, JPEG, WEBP, GIF, SVG).', 'Invalid File');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setSlideImageUploading(true);
    setError('');

    try {
      const { data } = await API.post('/lessons/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = [...slides];
      updated[slideIdx] = {
        ...updated[slideIdx],
        imageUrl: data.fileUrl,
        imageName: data.fileName || file.name,
        imagePosition: updated[slideIdx].imagePosition || 'right',
      };
      setSlides(updated);
      toast.success('Picture added to slide.', 'Image Uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image.', 'Upload Failed');
    } finally {
      setSlideImageUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (baseName) {
        setTitle(baseName);
      }
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError('');

    try {
      const { data } = await API.post('/lessons/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadedPresentation({
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        publicId: data.publicId || '',
        resourceType: data.resourceType || '',
      });
      toast.success(`"${data.fileName}" uploaded and ready to publish.`, 'Presentation Uploaded');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to upload the presentation file. Please try again.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (uploading) {
      setError('Please wait for the file upload to finish before saving.');
      return;
    }

    let finalTitle = title.trim();
    if (!finalTitle && presentationType === 'upload' && uploadedPresentation?.fileName) {
      finalTitle = uploadedPresentation.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setTitle(finalTitle);
    }

    if (!finalTitle) {
      setError('Please enter a topic title before saving.');
      return;
    }

    if (presentationType === 'upload' && !uploadedPresentation) {
      setError('Please upload a presentation file (.pptx, .ppt, or .pdf) or select "Build Interactive Slides".');
      return;
    }

    if (presentationType === 'create' && slides.length === 0) {
      setError('Please create at least one slide for this topic.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        classId,
        title: finalTitle,
        presentationType,
        slides: presentationType === 'create' ? slides : [],
        attachments: presentationType === 'upload' && uploadedPresentation ? [uploadedPresentation] : [],
        summary: summary || '',
        content: '',
      };

      let result;
      if (lessonToEdit) {
        const { data } = await API.put(`/lessons/${lessonToEdit._id}`, payload);
        result = data;
        toast.success(`Changes to "${finalTitle}" have been saved.`, 'Topic Updated');
      } else {
        const { data } = await API.post('/lessons', payload);
        result = data;
        toast.success(`Topic "${finalTitle}" has been added to the syllabus.`, 'Topic Published');
      }

      if (onLessonSaved) onLessonSaved(result);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save topic.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentSlide = slides[activeSlideIdx] || slides[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-xs">
                <BookOpen size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {lessonToEdit ? 'Edit Course Topic' : 'Add Course Topic'}
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 rounded-md">
                    Topic {lessonToEdit ? lessonToEdit.order : nextTopicNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the topic title and select the presentation format visible to students.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="p-3.5 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Topic Title Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Topic Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g., Introduction to Object-Oriented Programming"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            {/* Presentation Format Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Presentation Format
                </label>
                <span className="text-[11px] text-slate-500">
                  Only the selected format will be published to students
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Upload File */}
                <button
                  type="button"
                  onClick={() => handleSelectMode('upload')}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    presentationType === 'upload'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      presentationType === 'upload'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Upload size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        Upload Presentation Deck
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          presentationType === 'upload'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {presentationType === 'upload' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Upload an existing PowerPoint (<strong>.pptx</strong>, <strong>.ppt</strong>) or <strong>.pdf</strong> presentation file.
                    </p>
                  </div>
                </button>

                {/* Option 2: Create Slides */}
                <button
                  type="button"
                  onClick={() => handleSelectMode('create')}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    presentationType === 'create'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      presentationType === 'create'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Presentation size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        Build Interactive Slides
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          presentationType === 'create'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {presentationType === 'create' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Author structured presentation slides with key points and diagrams directly in the LMS.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Presentation Content Area */}
            {presentationType === 'upload' ? (
              /* UPLOAD PRESENTATION FILE PANEL */
              <div>
                {!uploadedPresentation ? (
                  <div className="p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl text-center bg-slate-50/60 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
                      <Upload size={22} />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Select Presentation File
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
                      Supported formats: PowerPoint (<strong>.pptx</strong>, <strong>.ppt</strong>) and PDF (<strong>.pdf</strong>) up to 50 MB.
                    </p>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs transition-all">
                      {uploading ? (
                        <>
                          <Loader2 className="animate-spin" size={15} />
                          <span>Uploading Presentation...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={15} />
                          <span>Browse Files</span>
                        </>
                      )}
                      <input
                        type="file"
                        disabled={uploading}
                        accept=".pdf,.ppt,.pptx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 size={15} />
                        <span>Selected Presentation File</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">
                        Visible to enrolled students
                      </span>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100 shrink-0">
                          <Presentation size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {uploadedPresentation.fileName}
                          </p>
                          <span className="text-xs text-slate-500">
                            {uploadedPresentation.fileSize
                              ? `${Math.round(uploadedPresentation.fileSize / 1024)} KB`
                              : 'Ready for viewing'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                          {uploading ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Replacing...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw size={13} />
                              <span>Replace File</span>
                            </>
                          )}
                          <input
                            type="file"
                            disabled={uploading}
                            accept=".pdf,.ppt,.pptx"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setUploadedPresentation(null)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove File"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Lesson Summary & Key Takeaways for Uploaded Presentations */}
                <div className="pt-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    <Sparkles size={13} className="text-blue-600" />
                    <span>Lesson Summary &amp; Key Takeaways (Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Enter key takeaways or summary displayed below the presentation deck to help students review before the assessment..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            ) : (
              /* BUILD INTERACTIVE SLIDES PANEL */
              <div className="space-y-5">
                {/* Slide Strip Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {slides.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveSlideIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                          activeSlideIdx === idx
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Slide {idx + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={addSlide}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add Slide</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {slides.length > 1 && (
                      <>
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 mr-1">
                          <button
                            type="button"
                            disabled={activeSlideIdx === 0}
                            onClick={() => moveSlide(activeSlideIdx, 'left')}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:pointer-events-none transition-all"
                            title="Move Slide Earlier (Left)"
                          >
                            <MoveLeft size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={activeSlideIdx === slides.length - 1}
                            onClick={() => moveSlide(activeSlideIdx, 'right')}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:pointer-events-none transition-all"
                            title="Move Slide Later (Right)"
                          >
                            <MoveRight size={13} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeSlide(activeSlideIdx)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={14} />
                          <span>Delete Slide {activeSlideIdx + 1}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Active Slide Editor Card */}
                {currentSlide && (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Editing Slide {activeSlideIdx + 1} of {slides.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={activeSlideIdx === 0}
                          onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                          className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                          title="Previous Slide"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={activeSlideIdx === slides.length - 1}
                          onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                          className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                          title="Next Slide"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Slide Heading
                      </label>
                      <input
                        type="text"
                        value={currentSlide.title}
                        onChange={(e) => handleSlideChange(activeSlideIdx, 'title', e.target.value)}
                        placeholder="Enter slide heading..."
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Slide Narrative / Explanation
                      </label>
                      <textarea
                        rows={3}
                        value={currentSlide.content}
                        onChange={(e) => handleSlideChange(activeSlideIdx, 'content', e.target.value)}
                        placeholder="Provide the core explanation or lecture text for this slide..."
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
                      />
                    </div>

                    {/* Key Points / Bullets */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Key Points
                        </label>
                        <button
                          type="button"
                          onClick={() => addBullet(activeSlideIdx)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          + Add Point
                        </button>
                      </div>
                      <div className="space-y-2">
                        {currentSlide.bullets?.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                            <input
                              type="text"
                              value={b}
                              onChange={(e) => handleBulletChange(activeSlideIdx, bIdx, e.target.value)}
                              placeholder={`Point ${bIdx + 1}`}
                              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                            />
                            <button
                              type="button"
                              onClick={() => removeBullet(activeSlideIdx, bIdx)}
                              className="p-1 text-slate-400 hover:text-red-500"
                              title="Remove Point"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Slide Picture & Diagram Area */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-blue-600" />
                          <span>Slide Picture / Diagram</span>
                        </label>
                        {currentSlide.imageUrl && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">Layout:</span>
                            <select
                              value={currentSlide.imagePosition || 'right'}
                              onChange={(e) => handleSlideChange(activeSlideIdx, 'imagePosition', e.target.value)}
                              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="right">Side-by-side (Right)</option>
                              <option value="left">Side-by-side (Left)</option>
                              <option value="bottom">Below Narrative</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {currentSlide.imageUrl ? (
                        /* Image Preview Card */
                        <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              <img
                                src={currentSlide.imageUrl}
                                alt="Slide preview"
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {currentSlide.imageName || 'Slide Picture Attached'}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                {currentSlide.imageUrl}
                              </p>
                              <span className="inline-block mt-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                Layout: {currentSlide.imagePosition === 'left' ? 'Side-by-side (Left)' : currentSlide.imagePosition === 'bottom' ? 'Below Narrative' : 'Side-by-side (Right)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                              {slideImageUploading ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-blue-600" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload size={13} />
                                  <span>Replace</span>
                                </>
                              )}
                              <input
                                type="file"
                                disabled={slideImageUploading}
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleSlideImageUpload(file, activeSlideIdx);
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                handleSlideChange(activeSlideIdx, 'imageUrl', '');
                                handleSlideChange(activeSlideIdx, 'imageName', '');
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove Picture"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Drag & Drop Dropzone */
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingSlideImage(true);
                          }}
                          onDragLeave={() => setIsDraggingSlideImage(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingSlideImage(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleSlideImageUpload(file, activeSlideIdx);
                          }}
                          onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (items) {
                              for (let i = 0; i < items.length; i++) {
                                if (items[i].type.startsWith('image/')) {
                                  const file = items[i].getAsFile();
                                  if (file) {
                                    handleSlideImageUpload(file, activeSlideIdx);
                                    break;
                                  }
                                }
                              }
                            }
                          }}
                          className={`p-6 border-2 border-dashed rounded-xl text-center transition-all ${
                            isDraggingSlideImage
                              ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                              : 'border-slate-300 hover:border-blue-400 bg-white'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100">
                            {slideImageUploading ? (
                              <Loader2 size={20} className="animate-spin" />
                            ) : (
                              <ImageIcon size={20} />
                            )}
                          </div>

                          <p className="text-xs font-bold text-slate-800">
                            {slideImageUploading ? 'Uploading picture to cloud...' : 'Drag & drop picture or diagram here'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                            Supports PNG, JPG, JPEG, WEBP, GIF, SVG • Paste screenshot directly with Ctrl+V
                          </p>

                          <div className="flex items-center justify-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-xs transition-colors">
                              <Upload size={13} />
                              <span>Browse Picture</span>
                              <input
                                type="file"
                                disabled={slideImageUploading}
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleSlideImageUpload(file, activeSlideIdx);
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => setShowUrlInput(!showUrlInput)}
                              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              {showUrlInput ? 'Hide URL input' : 'Or enter URL'}
                            </button>
                          </div>

                          {showUrlInput && (
                            <div className="mt-3 max-w-md mx-auto relative text-left">
                              <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="url"
                                value={currentSlide.imageUrl || ''}
                                onChange={(e) => handleSlideChange(activeSlideIdx, 'imageUrl', e.target.value)}
                                placeholder="https://example.com/diagram.png"
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Optional Topic Summary */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    <Sparkles size={13} className="text-blue-600" />
                    <span>Key Takeaways & Summary (Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Optional summary displayed at the end of the slide deck to help students prepare for the topic assessment..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {presentationType === 'upload'
                ? 'Format: Uploaded Presentation Deck'
                : `Format: Interactive Slide Deck (${slides.length} ${slides.length === 1 ? 'Slide' : 'Slides'})`}
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs text-xs disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    <span>Uploading File...</span>
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    <span>Saving Topic...</span>
                  </>
                ) : (
                  <span>{lessonToEdit ? 'Save Changes' : 'Publish Topic'}</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateLessonModal;
