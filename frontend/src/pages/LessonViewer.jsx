import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Presentation, Sparkles,
  CheckCircle2, HelpCircle, Loader2, AlertCircle,
  ExternalLink, Maximize2, Minimize2, Lock, ChevronRight, ListOrdered
} from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import {
  isPdfArrayBuffer,
  parsePptxArrayBuffer,
  loadPdfFromBuffer,
  renderPdfPageToImageUrl,
} from '../utils/presentationParser';

const LessonViewer = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [lesson, setLesson] = useState(null);
  const [classLessons, setClassLessons] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [maxReachedSlideIndex, setMaxReachedSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCompletedPresentation, setHasCompletedPresentation] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Uploaded presentation state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadTotalSlides, setUploadTotalSlides] = useState(0);
  const [parsedPptxSlides, setParsedPptxSlides] = useState([]);
  const [slidePageImageUrls, setSlidePageImageUrls] = useState([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  // Sequential one-by-one iframe loader index so Office Online never collides or paints black
  const [sequentialPreloadMax, setSequentialPreloadMax] = useState(0);

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  const loadLesson = async () => {
    setLoading(true);
    setError('');
    setCurrentSlideIndex(0);
    setMaxReachedSlideIndex(0);
    setUploadTotalSlides(0);
    setParsedPptxSlides([]);
    setSlidePageImageUrls([]);
    setSequentialPreloadMax(0);

    try {
      const { data } = await API.get(`/lessons/${lessonId}`);
      setLesson(data);
      const alreadyCompleted = Boolean(data.progress?.slidesViewed || data.progress?.passed);
      setHasCompletedPresentation(alreadyCompleted);

      if (data.classId) {
        API.get(`/lessons/class/${data.classId}`)
          .then((res) => setClassLessons(res.data || []))
          .catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load this topic.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPresentationComplete = async (showToastNotification = true) => {
    if (hasCompletedPresentation || markingComplete || !lesson?._id) return;
    setMarkingComplete(true);
    try {
      const { data } = await API.post(`/lessons/${lesson._id}/view-slides`);
      setHasCompletedPresentation(true);
      if (data?.progress) {
        setLesson((prev) => (prev ? { ...prev, progress: data.progress } : prev));
      }
      if (showToastNotification) {
        toast.success(
          lesson.hasQuiz
            ? 'You have reached the end of the presentation! Topic assessment is now unlocked.'
            : 'You have reached the end of the presentation! Topic marked as completed.',
          lesson.hasQuiz ? 'Assessment Unlocked' : 'Presentation Completed'
        );
      }
    } catch {
      if (showToastNotification) {
        toast.error('Failed to record presentation completion. Please try again.', 'Error');
      }
    } finally {
      setMarkingComplete(false);
    }
  };

  const slides = lesson?.slides || [];
  const uploadedPresentation = lesson?.attachments?.[0] || null;

  // Strictly display ONLY the presentation format chosen by the instructor
  const activePresentationMode =
    lesson?.presentationType === 'create' ||
    (lesson?.presentationType !== 'upload' && slides.length > 0 && !uploadedPresentation)
      ? 'create'
      : 'upload';

  const isPptx = Boolean(
    uploadedPresentation?.fileName?.match(/\.pptx$/i) ||
      uploadedPresentation?.fileUrl?.match(/\.pptx(\?|$)/i)
  );
  const isPdf = Boolean(
    uploadedPresentation?.fileName?.match(/\.pdf$/i) ||
      uploadedPresentation?.fileType === 'application/pdf' ||
      uploadedPresentation?.fileUrl?.match(/\.pdf(\?|$)/i)
  );

  // Download & prepare uploaded presentation slides
  useEffect(() => {
    let createdBlobUrl = '';
    const createdSlideImgUrls = [];
    let isCancelled = false;

    const loadAndPrepareUploadedDeck = async () => {
      if (!lesson?._id || activePresentationMode !== 'upload' || !uploadedPresentation) {
        setPdfBlobUrl('');
        setUploadTotalSlides(0);
        setParsedPptxSlides([]);
        setSlidePageImageUrls([]);
        return;
      }

      setUploadLoading(true);
      try {
        const res = await API.get(
          `/lessons/${lesson._id}/attachment/0/download?inline=true&asPdf=true`,
          { responseType: 'arraybuffer' }
        );
        if (isCancelled) return;

        const arrayBuffer = res.data;

        if (isPdf || isPdfArrayBuffer(arrayBuffer)) {
          const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
          createdBlobUrl = window.URL.createObjectURL(pdfBlob);
          setPdfBlobUrl(createdBlobUrl);

          const { pdfDoc, totalSlides } = await loadPdfFromBuffer(arrayBuffer);
          if (isCancelled) return;

          setUploadTotalSlides(totalSlides);
          if (lesson.progress?.slidesViewed || lesson.progress?.passed) {
            setMaxReachedSlideIndex(Math.max(0, totalSlides - 1));
          }

          // Render Slide 1 immediately so the screen appears right away, then pre-render remaining slides in background
          if (totalSlides > 0) {
            const firstUrl = await renderPdfPageToImageUrl(pdfDoc, 1);
            if (isCancelled) return;
            createdSlideImgUrls.push(firstUrl);
            setSlidePageImageUrls([firstUrl]);
            setUploadLoading(false);

            for (let p = 2; p <= totalSlides; p++) {
              const pageUrl = await renderPdfPageToImageUrl(pdfDoc, p);
              if (isCancelled) return;
              createdSlideImgUrls.push(pageUrl);
              setSlidePageImageUrls((prev) => [...prev, pageUrl]);
            }
          }
        } else if (isPptx) {
          const parsed = await parsePptxArrayBuffer(arrayBuffer);
          if (isCancelled) return;
          setParsedPptxSlides(parsed.slides);
          setUploadTotalSlides(parsed.totalSlides);
          setSequentialPreloadMax(0);
          if (lesson.progress?.slidesViewed || lesson.progress?.passed) {
            setMaxReachedSlideIndex(Math.max(0, parsed.totalSlides - 1));
          }
        }
      } catch (err) {
        console.warn('Presentation preparation fallback:', err);
        if (!isCancelled && isPdf) {
          setPdfBlobUrl(uploadedPresentation.fileUrl);
        }
      } finally {
        if (!isCancelled) {
          setUploadLoading(false);
        }
      }
    };

    loadAndPrepareUploadedDeck();

    return () => {
      isCancelled = true;
      if (createdBlobUrl) {
        window.URL.revokeObjectURL(createdBlobUrl);
      }
      createdSlideImgUrls.forEach((u) => {
        if (u && u.startsWith('blob:')) window.URL.revokeObjectURL(u);
      });
    };
  }, [lesson?._id, activePresentationMode, uploadedPresentation?.fileUrl, isPdf, isPptx]);

  // Effective slide count across both 'create' and 'upload' modes
  const effectiveTotalSlides =
    activePresentationMode === 'create' ? slides.length : uploadTotalSlides;

  const isAtFinalSlide =
    effectiveTotalSlides > 0 && currentSlideIndex >= effectiveTotalSlides - 1;

  // Automatically unlock assessment when student reaches the final slide of ANY presentation
  useEffect(() => {
    if (!lesson?._id || uploadLoading) return;
    if (isAtFinalSlide && !hasCompletedPresentation) {
      handleMarkPresentationComplete(effectiveTotalSlides > 1);
    }
  }, [lesson?._id, isAtFinalSlide, hasCompletedPresentation, effectiveTotalSlides, uploadLoading]);

  const goToSlide = (targetIdx) => {
    if (targetIdx < 0 || targetIdx >= effectiveTotalSlides) return;
    if (targetIdx <= maxReachedSlideIndex + 1 || hasCompletedPresentation) {
      setCurrentSlideIndex(targetIdx);
      setMaxReachedSlideIndex((prev) => Math.max(prev, targetIdx));
      setSequentialPreloadMax((prev) => Math.max(prev, targetIdx));
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < effectiveTotalSlides - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  // Keyboard navigation for slides & Escape for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (effectiveTotalSlides > 0) {
        if (e.key === 'ArrowRight' && currentSlideIndex < effectiveTotalSlides - 1) {
          goToSlide(currentSlideIndex + 1);
        } else if (e.key === 'ArrowLeft' && currentSlideIndex > 0) {
          setCurrentSlideIndex((i) => i - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveTotalSlides, currentSlideIndex, maxReachedSlideIndex, hasCompletedPresentation, isFullscreen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-xs font-semibold text-slate-500">Loading course presentation...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl max-w-md w-full border border-slate-200 shadow-xs text-center">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
          <h3 className="text-base font-bold text-slate-900 mb-1">Topic Restricted or Unavailable</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">{error || 'Unable to access this topic.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Return to Syllabus
          </button>
        </div>
      </div>
    );
  }

  const isPassed = lesson.progress?.passed;
  const highestScore = lesson.progress?.highestScore || 0;
  const currentBuiltInSlide = slides[currentSlideIndex];
  const currentPptxSlide = parsedPptxSlides[currentSlideIndex];

  // Give each slide a distinct source URL query key so Microsoft Office Online never collides concurrent sessions
  const getOfficeEmbedUrl = (fileUrl, slideNumber = 1) => {
    if (!fileUrl) return '';
    const sep = fileUrl.includes('?') ? '&' : '?';
    const distinctSourceUrl = `${fileUrl}${sep}s=${slideNumber}`;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(distinctSourceUrl)}&wdSlideIndex=${slideNumber}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16">
      {/* Top Navigation & Module Switcher */}
      <nav className="bg-white border-b border-slate-200 px-3.5 sm:px-4 md:px-10 py-3 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              onClick={() => navigate(`/student/class/${lesson.classId}`)}
              className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold text-xs md:text-sm transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">List of Lessons</span>
              <span className="sm:hidden">Lessons</span>
            </button>

            <ChevronRight size={14} className="text-slate-300 shrink-0" />

            <span className="text-xs font-bold text-slate-900 truncate max-w-[140px] sm:max-w-md">
              Lesson {lesson.order}: {lesson.title}
            </span>
          </div>

          {/* Primary Actions: Next Lesson Status */}
          <div className="flex items-center gap-2 shrink-0">
            {effectiveTotalSlides > 0 && (
              <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] sm:text-xs font-bold">
                Slide {currentSlideIndex + 1}/{effectiveTotalSlides}
              </span>
            )}

            {lesson.nextLessonId && (
              isPassed ? (
                <Link
                  to={`/student/lesson/${lesson.nextLessonId}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span>Next Lesson</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <span
                  title="Complete this lesson's presentation and pass the assessment with at least 75% to unlock the next lesson"
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 hidden md:inline-flex items-center gap-1.5 cursor-not-allowed"
                >
                  <Lock size={13} />
                  <span>Next Lesson Locked</span>
                </span>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 flex flex-col">
        {/* Lesson Header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Lesson {lesson.order}
              </span>
              {isPassed ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  <CheckCircle2 size={12} />
                  Completed ({highestScore}%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-md">
                  Requires 75% Assessment Score to Advance
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              {lesson.title}
            </h1>
          </div>
        </div>

        {/* PRESENTATION STAGE: RENDERS ONLY THE FORMAT SELECTED BY THE INSTRUCTOR */}
        {activePresentationMode === 'upload' ? (
          /* UPLOADED PRESENTATION DECK VIEWER */
          <div className="space-y-4">
            {uploadedPresentation ? (
              <div
                className={
                  isFullscreen
                    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col'
                    : 'bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col'
                }
              >
                {/* Presentation Toolbar */}
                <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-indigo-600/90 p-1.5 rounded-lg shrink-0">
                      <Presentation size={15} />
                    </div>
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-semibold text-white truncate block">
                        {uploadedPresentation.fileName}
                      </span>
                      {effectiveTotalSlides > 0 && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold text-[11px] shrink-0">
                          Slide {currentSlideIndex + 1} / {effectiveTotalSlides}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <a
                      href={isPdf && pdfBlobUrl ? pdfBlobUrl : uploadedPresentation.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink size={12} />
                    </a>

                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors"
                      title="Toggle Full Screen"
                    >
                      {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      <span className="hidden sm:inline">
                        {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Presentation Body */}
                <div
                  className={
                    isFullscreen
                      ? 'flex-1 w-full bg-slate-900 overflow-auto flex flex-col justify-between'
                      : 'w-full min-h-[300px] sm:min-h-[440px] md:min-h-[540px] bg-slate-100 flex flex-col justify-between'
                  }
                >
                  {uploadLoading ? (
                    <div className="flex-1 min-h-[300px] sm:min-h-[440px] flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
                      <Loader2 size={28} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold">
                        Loading presentation slides...
                      </span>
                    </div>
                  ) : slidePageImageUrls.length > 0 ? (
                    /* Pre-rendered High-DPI Slide Images (PDF or Backend-Converted PPTX): Instant 0ms Switching, 0 Black Slides */
                    <div className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/95 overflow-auto">
                      {slidePageImageUrls[currentSlideIndex] ? (
                        <img
                          src={slidePageImageUrls[currentSlideIndex]}
                          alt={`Slide ${currentSlideIndex + 1} of ${effectiveTotalSlides}`}
                          className="rounded-lg shadow-2xl bg-white max-w-full max-h-[320px] sm:max-h-[480px] md:max-h-[620px] object-contain select-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-300 py-16 sm:py-24">
                          <Loader2 size={24} className="animate-spin text-indigo-400" />
                          <span className="text-xs font-semibold">
                            Rendering Slide {currentSlideIndex + 1}...
                          </span>
                        </div>
                      )}
                    </div>
                  ) : uploadTotalSlides > 0 ? (
                    /* Sequential Non-Occluded Office Viewer Stack (Full Opacity, Layered z-index so Office Online Never Paints Black) */
                    <div className="w-full h-[320px] sm:h-[460px] md:h-[580px] bg-slate-900 relative overflow-hidden">
                      {Array.from({ length: uploadTotalSlides }).map((_, slideIdx) => {
                        const isMounted =
                          slideIdx <= Math.max(sequentialPreloadMax, currentSlideIndex);
                        if (!isMounted) return null;
                        const isActive = slideIdx === currentSlideIndex;
                        return (
                          <iframe
                            key={`office-seq-${lesson._id}-${slideIdx}`}
                            src={getOfficeEmbedUrl(uploadedPresentation.fileUrl, slideIdx + 1)}
                            title={`${uploadedPresentation.fileName} - Slide ${slideIdx + 1}`}
                            onLoad={() => {
                              // Wait 750ms after this slide finishes painting at full opacity before queuing the next slide
                              setTimeout(() => {
                                setSequentialPreloadMax((prev) =>
                                  Math.min(
                                    uploadTotalSlides - 1,
                                    Math.max(prev, slideIdx + 1)
                                  )
                                );
                              }, 750);
                            }}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              border: 0,
                              opacity: 1,
                              zIndex: isActive ? 20 : 1,
                              pointerEvents: isActive ? 'auto' : 'none',
                            }}
                            allowFullScreen
                          />
                        );
                      })}
                    </div>
                  ) : (
                    /* Fallback Single Frame */
                    <div className="w-full h-[320px] sm:h-[460px] md:h-[580px] bg-slate-100">
                      <iframe
                        src={
                          isPdf
                            ? pdfBlobUrl || uploadedPresentation.fileUrl
                            : getOfficeEmbedUrl(uploadedPresentation.fileUrl, 1)
                        }
                        title={uploadedPresentation.fileName}
                        className="w-full h-full border-0"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {/* Slide-by-Slide Navigation Bar */}
                  {effectiveTotalSlides > 0 && (
                    <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 sm:gap-4">
                      <button
                        type="button"
                        onClick={handlePrevSlide}
                        disabled={currentSlideIndex === 0}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 sm:gap-1.5 shrink-0"
                      >
                        <ArrowLeft size={15} />
                        <span className="hidden xs:inline sm:inline">Previous Slide</span>
                        <span className="xs:hidden sm:hidden">Prev</span>
                      </button>

                      <div className="flex flex-col items-center text-center min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                          <span>
                            Slide {currentSlideIndex + 1}/{effectiveTotalSlides}
                          </span>
                          {isAtFinalSlide && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              <CheckCircle2 size={12} />
                              <span className="hidden sm:inline">Final Slide</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleNextSlide}
                        disabled={currentSlideIndex >= effectiveTotalSlides - 1}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 sm:gap-1.5 shrink-0"
                      >
                        <span className="hidden xs:inline sm:inline">Next Slide</span>
                        <span className="xs:hidden sm:hidden">Next</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
                <Presentation size={32} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 mb-1">Presentation Pending</h3>
                <p className="text-xs text-slate-500">
                  The presentation material for this lesson has not been published yet.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* INTERACTIVE SLIDES VIEWER ('create' mode) */
          <div className="flex-1 flex flex-col space-y-6">
            {slides.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
                <Presentation size={32} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 mb-1">Presentation Pending</h3>
                <p className="text-xs text-slate-500">
                  No presentation slides have been added to this topic yet.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-[320px] sm:min-h-[420px] bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
                <div>
                  <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 mb-4 sm:mb-6 gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
                      Slide {currentSlideIndex + 1}/{slides.length}
                    </span>
                    <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 max-w-[200px] sm:max-w-none">
                      {slides.map((_, idx) => {
                        const canJump = idx <= maxReachedSlideIndex || hasCompletedPresentation;
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={!canJump}
                            onClick={() => goToSlide(idx)}
                            className={`h-2 rounded-full transition-all shrink-0 ${
                              idx === currentSlideIndex
                                ? 'w-5 sm:w-6 bg-indigo-600'
                                : canJump
                                  ? 'w-2 bg-indigo-200 hover:bg-indigo-400 cursor-pointer'
                                  : 'w-2 bg-slate-200 cursor-not-allowed'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 mb-3 sm:mb-4">
                    {currentBuiltInSlide?.title}
                  </h2>

                  {currentBuiltInSlide?.imageUrl && (currentBuiltInSlide.imagePosition === 'right' || currentBuiltInSlide.imagePosition === 'left') ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-8 items-center mb-6">
                      <div className={`md:col-span-7 ${currentBuiltInSlide.imagePosition === 'left' ? 'md:order-2' : 'md:order-1'}`}>
                        {currentBuiltInSlide?.content && (
                          <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed mb-4 sm:mb-5 whitespace-pre-line">
                            {currentBuiltInSlide.content}
                          </p>
                        )}
                        {currentBuiltInSlide?.bullets && currentBuiltInSlide.bullets.length > 0 && (
                          <ul className="space-y-2.5 sm:space-y-3">
                            {currentBuiltInSlide.bullets.map((bullet, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-800">
                                <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-indigo-600 mt-1.5 sm:mt-2 shrink-0" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className={`md:col-span-5 flex justify-center ${currentBuiltInSlide.imagePosition === 'left' ? 'md:order-1' : 'md:order-2'}`}>
                        <div className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-60 sm:max-h-80 flex items-center justify-center bg-slate-50 p-2">
                          <img
                            src={currentBuiltInSlide.imageUrl}
                            alt={currentBuiltInSlide.title}
                            className="max-h-56 sm:max-h-76 max-w-full object-contain rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {currentBuiltInSlide?.content && (
                        <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed mb-4 sm:mb-6 whitespace-pre-line">
                          {currentBuiltInSlide.content}
                        </p>
                      )}

                      {currentBuiltInSlide?.bullets && currentBuiltInSlide.bullets.length > 0 && (
                        <ul className="space-y-2.5 sm:space-y-3 mb-5 sm:mb-6">
                          {currentBuiltInSlide.bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-800">
                              <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-indigo-600 mt-1.5 sm:mt-2 shrink-0" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {currentBuiltInSlide?.imageUrl && (
                        <div className="my-4 sm:my-6 rounded-2xl overflow-hidden border border-slate-200 shadow-xs max-h-60 sm:max-h-80 flex items-center justify-center bg-slate-50 p-2">
                          <img
                            src={currentBuiltInSlide.imageUrl}
                            alt={currentBuiltInSlide.title}
                            className="max-h-56 sm:max-h-76 max-w-full object-contain rounded-xl"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Slide Navigation Controls */}
                <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-slate-100 mt-6 sm:mt-8 gap-2">
                  <button
                    onClick={handlePrevSlide}
                    disabled={currentSlideIndex === 0}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 sm:gap-1.5 shrink-0"
                  >
                    <ArrowLeft size={15} />
                    <span className="hidden xs:inline sm:inline">Previous Slide</span>
                    <span className="xs:hidden sm:hidden">Prev</span>
                  </button>

                  <button
                    onClick={handleNextSlide}
                    disabled={currentSlideIndex === slides.length - 1}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 sm:gap-1.5 shrink-0"
                  >
                    <span className="hidden xs:inline sm:inline">Next Slide</span>
                    <span className="xs:hidden sm:hidden">Next</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* END OF LESSON: SUMMARY & KEY TAKEAWAYS (ONLY SHOWN AT THE END OF THE LESSON) */}
        {(isAtFinalSlide || isPassed || hasCompletedPresentation) && lesson.summary && (
          <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 mb-2.5">
              <Sparkles size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Lesson Summary & Key Takeaways</h3>
            </div>
            <div className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {lesson.summary}
            </div>
          </div>
        )}

        {/* END OF PRESENTATION: AUTOMATIC SLIDE-GATED ASSESSMENT */}
        {effectiveTotalSlides > 0 && !isAtFinalSlide ? (
          /* Student has NOT reached the final slide of the presentation yet */
          <div className="mt-6 p-5 rounded-2xl border border-slate-200 bg-slate-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Topic Assessment Locked Until Final Slide
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  You are on Slide {currentSlideIndex + 1} of {effectiveTotalSlides}. Reach the final slide (Slide {effectiveTotalSlides} of {effectiveTotalSlides}) to unlock the assessment.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleNextSlide}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>Next Slide ({currentSlideIndex + 2}/{effectiveTotalSlides})</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          /* Student has reached the final slide (Slide N of N) — Assessment Unlocked! */
          <div
            className={`mt-6 p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isPassed
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 font-bold text-sm mb-1 text-slate-900">
                {isPassed ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <HelpCircle size={18} className="text-indigo-600" />
                )}
                <span>
                  {isPassed
                    ? `Lesson ${lesson.order} Completed (Best Score: ${highestScore}%)`
                    : 'End of Presentation — Lesson Assessment Unlocked'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isPassed
                  ? 'You have met the 75% mastery requirement for this lesson and unlocked the next lesson.'
                  : 'You have reached the final slide of this presentation. Complete the lesson assessment with a score of 75% or higher to unlock the next lesson.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {lesson.hasQuiz && (
                <Link
                  to={`/student/quiz/${lesson.quizId}`}
                  onClick={() => {
                    if (!hasCompletedPresentation) {
                      handleMarkPresentationComplete(false);
                    }
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isPassed
                      ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                  }`}
                >
                  <HelpCircle size={15} />
                  <span>{isPassed ? `Retake Assessment (${highestScore}%)` : 'Start Lesson Assessment'}</span>
                </Link>
              )}

              {lesson.nextLessonId && (
                isPassed ? (
                  <Link
                    to={`/student/lesson/${lesson.nextLessonId}`}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs inline-flex items-center gap-1.5"
                  >
                    <span>Proceed to Next Lesson</span>
                    <ArrowRight size={15} />
                  </Link>
                ) : (
                  <span className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-200">
                    <Lock size={14} />
                    <span>Next Lesson Locked (75% Required)</span>
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LessonViewer;
