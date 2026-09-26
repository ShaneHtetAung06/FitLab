'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import VideoEmbed from '@/components/VideoEmbed';
import { formatDuration } from '@/lib/courseOptions';

/** Flattens the curriculum into the order lessons are taken in. */
function flattenLessons(course) {
  const flat = [];

  (course?.sections || []).forEach((section, sectionIndex) => {
    (section.lessons || []).forEach((lesson) => {
      flat.push({
        ...lesson,
        sectionTitle: section.title,
        sectionIndex,
      });
    });
  });

  return flat;
}

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const courseId = params?.id;

  const [course, setCourse] = useState(null);
  const [access, setAccess] = useState(null);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;

    try {
      const res = await fetch(`/api/courses/${courseId}`);
      const data = await res.json();

      if (!data.success) {
        setLoadError(data.message || 'Could not load this course');
        return;
      }

      setCourse(data.course);
      setAccess(data.access);
      setCompletedIds(new Set(data.progress?.completedLessonIds || []));

      const flat = flattenLessons(data.course);
      if (flat.length > 0) {
        // Resume on the first unfinished lesson rather than always the first.
        const done = new Set(data.progress?.completedLessonIds || []);
        const next = flat.find((lesson) => !done.has(String(lesson._id))) || flat[0];
        setActiveLessonId(String(next._id));
      }
    } catch (error) {
      setLoadError('Could not load this course');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const lessons = useMemo(() => flattenLessons(course), [course]);
  const activeIndex = lessons.findIndex(
    (lesson) => String(lesson._id) === activeLessonId
  );
  const activeLesson = activeIndex >= 0 ? lessons[activeIndex] : null;

  const toggleComplete = async (lesson, completed) => {
    setIsSaving(true);

    // Optimistic: ticking a lesson should feel instant.
    const nextSet = new Set(completedIds);
    if (completed) nextSet.add(String(lesson._id));
    else nextSet.delete(String(lesson._id));
    setCompletedIds(nextSet);

    try {
      const res = await fetch(`/api/courses/${courseId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: String(lesson._id), completed }),
      });

      const data = await res.json();

      if (data.success) {
        setCompletedIds(new Set(data.progress.completedLessonIds || []));

        if (data.progress.isComplete && completed) {
          toast.success('Course complete. Nice work!');
        }
      } else {
        // Roll back so the tick never lies about what was saved.
        setCompletedIds(completedIds);
        toast.error(data.message || 'Could not save your progress');
      }
    } catch (error) {
      setCompletedIds(completedIds);
      toast.error('Could not save your progress');
    } finally {
      setIsSaving(false);
    }
  };

  const goTo = (index) => {
    const lesson = lessons[index];
    if (!lesson) return;
    setActiveLessonId(String(lesson._id));
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-4xl block mb-3" aria-hidden="true">
          🔍
        </span>
        <h1 className="text-2xl font-bold text-gray-900">Course unavailable</h1>
        <p className="text-gray-600 mt-1">{loadError || 'Course not found'}</p>
        <Link
          href="/courses"
          className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-semibold"
        >
          Browse all courses
        </Link>
      </div>
    );
  }

  // The API withholds lesson bodies from anyone without access, so this is a
  // usability gate rather than the security boundary.
  if (!access?.hasFullAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-4xl block mb-3" aria-hidden="true">
          🔒
        </span>
        <h1 className="text-2xl font-bold text-gray-900">You are not enrolled</h1>
        <p className="text-gray-600 mt-1">
          Enrol in “{course.title}” to work through the lessons.
        </p>
        <Link
          href={`/courses/${courseId}`}
          className="inline-block mt-4 bg-primary-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
        >
          View the course
        </Link>
      </div>
    );
  }

  const completedCount = lessons.filter((lesson) =>
    completedIds.has(String(lesson._id))
  ).length;
  const percent =
    lessons.length === 0 ? 0 : Math.round((completedCount / lessons.length) * 100);
  const isActiveComplete = activeLesson
    ? completedIds.has(String(activeLesson._id))
    : false;

  const sidebar = (
    <nav aria-label="Course curriculum" className="space-y-4">
      {(course.sections || []).map((section, sectionIndex) => (
        <div key={section._id || sectionIndex}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1">
            {sectionIndex + 1}. {section.title}
          </p>
          <ul className="space-y-0.5">
            {(section.lessons || []).map((lesson) => {
              const id = String(lesson._id);
              const isActive = id === activeLessonId;
              const isDone = completedIds.has(id);

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLessonId(id);
                      setSidebarOpen(false);
                    }}
                    aria-current={isActive ? 'true' : undefined}
                    className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-800 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 ${
                        isDone ? 'text-accent-600' : 'text-gray-300'
                      }`}
                      aria-hidden="true"
                    >
                      {isDone ? '✓' : '○'}
                    </span>
                    <span className="flex-1 min-w-0">
                      {lesson.title}
                      {lesson.duration > 0 && (
                        <span className="block text-xs text-gray-500">
                          {formatDuration(lesson.duration)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <Link
            href={`/courses/${courseId}`}
            className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
          >
            ← {course.title}
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <div
              className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course progress"
            >
              <div
                className="h-full bg-accent-500 rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {completedCount} of {lessons.length} complete ({percent}%)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
          className="lg:hidden border border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-semibold hover:bg-gray-50"
        >
          {sidebarOpen ? 'Hide lessons' : 'All lessons'}
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <aside
          className={`lg:col-span-1 ${sidebarOpen ? 'block' : 'hidden'} lg:block`}
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            {sidebar}
          </div>
        </aside>

        {/* Lesson body */}
        <main className="lg:col-span-3">
          {!activeLesson ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
              <span className="text-4xl block mb-3" aria-hidden="true">
                📭
              </span>
              <h2 className="text-xl font-semibold text-gray-900">
                No lessons yet
              </h2>
              <p className="text-gray-600 mt-1">
                Your coach has not added any lessons to this course yet.
              </p>
            </div>
          ) : (
            <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                {activeLesson.sectionTitle}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                {activeLesson.title}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Lesson {activeIndex + 1} of {lessons.length}
                {activeLesson.duration > 0 &&
                  ` · ${formatDuration(activeLesson.duration)}`}
              </p>

              {activeLesson.videoUrl && (
                <div className="mt-5">
                  <VideoEmbed url={activeLesson.videoUrl} title={activeLesson.title} />
                </div>
              )}

              {activeLesson.content && (
                <div className="mt-5 text-gray-800 whitespace-pre-line leading-relaxed">
                  {activeLesson.content}
                </div>
              )}

              {!activeLesson.videoUrl && !activeLesson.content && (
                <p className="mt-5 text-gray-500 italic">
                  This lesson has no content yet.
                </p>
              )}

              {/* Controls */}
              <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => toggleComplete(activeLesson, !isActiveComplete)}
                  className={`py-2.5 px-5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                    isActiveComplete
                      ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'bg-accent-600 text-white hover:bg-accent-700'
                  }`}
                >
                  {isActiveComplete ? '✓ Completed' : 'Mark as complete'}
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => goTo(activeIndex - 1)}
                    className="py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    disabled={activeIndex >= lessons.length - 1}
                    onClick={() => goTo(activeIndex + 1)}
                    className="py-2.5 px-4 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </article>
          )}

          {percent === 100 && lessons.length > 0 && (
            <div className="mt-6 bg-accent-50 border border-accent-200 rounded-xl p-6 text-center">
              <span className="text-3xl block mb-2" aria-hidden="true">
                🎉
              </span>
              <h2 className="text-lg font-semibold text-gray-900">
                You finished the course
              </h2>
              <p className="text-gray-600 mt-1">
                Leave a review to let other learners know how it went.
              </p>
              <Link
                href={`/courses/${courseId}`}
                className="inline-block mt-3 bg-accent-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-accent-700 transition-colors"
              >
                Write a review
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
