'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import VideoEmbed from '@/components/VideoEmbed';
import CourseReviews from '@/components/CourseReviews';
import { formatPrice, formatDuration } from '@/lib/courseOptions';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'reviews', label: 'Reviews' },
];

function Icon({ name }) {
  const paths = {
    clock: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
    doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    users:
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    check: 'M5 13l4 4L19 7',
    play: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
  };

  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d={paths[name]}
      />
    </svg>
  );
}

function SpecRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function CourseDetailBody() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const courseId = params?.id;
  const sessionId = searchParams.get('session_id');
  const wasCancelled = searchParams.get('checkout') === 'cancelled';

  const [course, setCourse] = useState(null);
  const [access, setAccess] = useState(null);
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const [previewLesson, setPreviewLesson] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const tabsRef = useRef(null);

  // Guards against the confirm call firing twice in React strict mode.
  const confirmedRef = useRef(false);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;

    try {
      const res = await fetch(`/api/courses/${courseId}`);
      const data = await res.json();

      if (data.success) {
        setCourse(data.course);
        setAccess(data.access);
        setProgress(data.progress);
        // Open the first section so the curriculum is not a wall of closed rows.
        if (data.course.sections?.[0]?._id) {
          setOpenSections({ [data.course.sections[0]._id]: true });
        }
      } else {
        setLoadError(data.message || 'Could not load this course');
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

  useEffect(() => {
    if (wasCancelled) {
      toast('Checkout cancelled. You have not been charged.');
      router.replace(`/courses/${courseId}`, { scroll: false });
    }
  }, [wasCancelled, courseId, router]);

  // Returning from Stripe Checkout. The webhook is authoritative, but it needs
  // `stripe listen` locally and can lag in production, so confirm directly too.
  useEffect(() => {
    if (!sessionId || confirmedRef.current || authLoading || !user) return;
    confirmedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/enrollments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();

        if (data.success) {
          toast.success(data.message);
          await fetchCourse();
        } else {
          toast.error(data.message || 'Could not confirm your payment');
        }
      } catch (error) {
        toast.error('Could not confirm your payment');
      } finally {
        router.replace(`/courses/${courseId}`, { scroll: false });
      }
    })();
  }, [sessionId, authLoading, user, courseId, fetchCourse, router]);

  const enroll = async () => {
    if (!user) {
      router.push(`/login?callbackUrl=/courses/${courseId}`);
      return;
    }

    setIsEnrolling(true);

    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: 'POST' });
      const data = await res.json();

      if (data.success && data.checkoutUrl) {
        // Hand off to Stripe's hosted checkout.
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.success) {
        toast.success(data.message);
        await fetchCourse();
      } else {
        toast.error(data.message || 'Could not start enrollment');
        if (data.alreadyEnrolled) await fetchCourse();
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsEnrolling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="display text-2xl">Course unavailable</h1>
        <p className="mt-2 text-sm text-ink-500">{loadError || 'Course not found'}</p>
        <Link href="/courses" className="btn btn-primary btn-sm mt-6">
          Browse all courses
        </Link>
      </div>
    );
  }

  const isEnrolled = access?.isEnrolled;
  const isOwner = access?.isOwner;
  // Admins read everything for moderation and are refused at the enroll route,
  // so the purchase panel offers them review tools instead of a dead button.
  const isAdmin = access?.isAdmin;
  const sections = course.sections || [];
  const previewLessons = sections
    .flatMap((section) => section.lessons || [])
    .filter((lesson) => lesson.isPreview && (lesson.videoUrl || lesson.content));

  /**
   * Jumps to the curriculum with the first free lesson expanded. Uses the real
   * preview lessons the trainer marked, so the button never promises a preview
   * that does not exist.
   */
  const openFirstPreview = () => {
    const first = previewLessons[0];
    if (!first) return;

    const owner = sections.find((section) =>
      (section.lessons || []).some((lesson) => lesson._id === first._id)
    );

    setActiveTab('curriculum');
    if (owner?._id) setOpenSections((prev) => ({ ...prev, [owner._id]: true }));
    setPreviewLesson(first);

    // Scroll down to the tabs so the user actually sees the change
    if (tabsRef.current) {
      tabsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const includes = [
    `${course.totalLessons} on-demand lesson${course.totalLessons === 1 ? '' : 's'}`,
    course.totalDuration > 0 && `${formatDuration(course.totalDuration)} of material`,
    `${course.level} level`,
    previewLessons.length > 0 && `${previewLessons.length} free preview lesson${
      previewLessons.length === 1 ? '' : 's'
    }`,
    'Lifetime access',
    'Direct messaging with your trainer',
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 transition-colors hover:text-primary-600"
      >
        <span aria-hidden="true">‹</span> All courses
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_21rem] lg:gap-14">
        {/* ------------------------------------------------------------ Main */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-ink-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-700">
              {course.category}
            </span>
            <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700">
              {course.level}
            </span>
            {isOwner && (
              <span className="rounded-full border border-ink-900 bg-ink-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Your course
              </span>
            )}
          </div>

          <h1 className="display mt-4 text-3xl leading-tight sm:text-[2.6rem]">
            {course.title}
          </h1>

          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-card bg-bone">
            {course.thumbnail ? (
              <Image
                src={course.thumbnail}
                alt=""
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
                unoptimized
              />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-5xl"
                aria-hidden="true"
              >
                🏋️
              </span>
            )}
          </div>

          {/* Meta strip */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-ink-100 pb-5 text-[13px] text-ink-500">
            {course.totalDuration > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" />
                {formatDuration(course.totalDuration)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Icon name="doc" />
              {course.totalLessons} lesson{course.totalLessons === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="users" />
              {(course.totalEnrollments || 0).toLocaleString('en-US')} student
              {course.totalEnrollments === 1 ? '' : 's'}
            </span>
            {course.totalReviews > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-primary-600" aria-hidden="true">
                  ★
                </span>
                <span className="font-semibold text-ink-900">
                  {course.averageRating.toFixed(1)}
                </span>
                <span>({course.totalReviews} reviews)</span>
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>

          {/* Instructor panel */}
          {course.trainer && (
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-card bg-bone p-5">
              <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-primary-100">
                {course.trainer.avatar ? (
                  <Image
                    src={course.trainer.avatar}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-primary-700">
                    {course.trainer.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink-500">Your instructor</p>
                <p className="flex items-center gap-1.5 font-display text-base font-bold text-ink-900">
                  {course.trainer.name}
                  <svg
                    className="h-4 w-4 text-primary-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-label="Verified trainer"
                    role="img"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </p>
                <p className="text-[13px] text-primary-600">{course.category}</p>
              </div>

              {course.totalReviews > 0 && (
                <div className="text-right">
                  <p className="font-display text-base font-bold text-ink-900">
                    ★ {course.averageRating.toFixed(1)}
                  </p>
                  <p className="text-[11px] text-ink-500">Course rating</p>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div ref={tabsRef} className="mt-8 border-b border-ink-100 scroll-mt-24">
            <div className="flex gap-7" role="tablist" aria-label="Course details">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative -mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-ink-900 text-ink-900'
                        : 'border-transparent text-ink-500 hover:text-ink-900'
                    }`}
                  >
                    {tab.label}
                    {tab.key === 'reviews' && course.totalReviews > 0 && (
                      <span className="ml-1 text-ink-400">({course.totalReviews})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------- Overview tab */}
          {activeTab === 'overview' && (
            <div role="tabpanel" className="pt-7">
              <h2 className="display text-xl">About this course</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">
                {course.description}
              </p>

              {/* Section titles double as the syllabus summary: real content
                  rather than invented marketing bullets. */}
              {sections.length > 0 && (
                <>
                  <h2 className="display mt-8 text-xl">What you&apos;ll work on</h2>
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {sections.slice(0, 8).map((section) => (
                      <li
                        key={section._id}
                        className="flex items-start gap-2.5 text-[14px] text-ink-600"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        {section.title}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-8 rounded-card bg-bone p-6">
                <h2 className="display text-lg">This course includes</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {includes.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-[14px] text-ink-600"
                    >
                      <span className="text-primary-600">
                        <Icon name="check" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {course.trainer?.bio && (
                <>
                  <h2 className="display mt-8 text-xl">
                    About {course.trainer.name}
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">
                    {course.trainer.bio}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ----------------------------------------------- Curriculum tab */}
          {activeTab === 'curriculum' && (
            <div role="tabpanel" className="pt-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display text-xl">Curriculum</h2>
                <p className="text-[13px] text-ink-500">
                  {course.totalSections} section
                  {course.totalSections === 1 ? '' : 's'} · {course.totalLessons} lesson
                  {course.totalLessons === 1 ? '' : 's'}
                  {course.totalDuration > 0 &&
                    ` · ${formatDuration(course.totalDuration)}`}
                </p>
              </div>

              {sections.length === 0 ? (
                <p className="mt-4 text-sm text-ink-500">
                  The trainer has not added any lessons yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {sections.map((section, sectionIndex) => {
                    const isOpen = Boolean(openSections[section._id]);
                    const lessons = section.lessons || [];

                    return (
                      <li
                        key={section._id || sectionIndex}
                        className="overflow-hidden rounded-card border border-ink-100"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSections((prev) => ({
                              ...prev,
                              [section._id]: !isOpen,
                            }))
                          }
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-3 bg-white p-4 text-left transition-colors hover:bg-bone"
                        >
                          <svg
                            className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${
                              isOpen ? '' : '-rotate-90'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                          <span className="flex-1 text-sm font-semibold text-ink-900">
                            <span className="text-ink-400">
                              {String(sectionIndex + 1).padStart(2, '0')}
                            </span>{' '}
                            {section.title}
                          </span>
                          <span className="shrink-0 text-[12px] text-ink-400">
                            {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
                          </span>
                        </button>

                        {isOpen && (
                          <ul className="divide-y divide-ink-100 border-t border-ink-100">
                            {lessons.map((lesson) => {
                              const canPlay = !lesson.isLocked;
                              const isPreviewable =
                                lesson.isPreview && !isEnrolled && !isOwner;

                              return (
                                <li key={lesson._id} className="bg-white px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={
                                        canPlay ? 'text-primary-600' : 'text-ink-300'
                                      }
                                    >
                                      <Icon name={canPlay ? 'play' : 'lock'} />
                                    </span>

                                    <span className="flex-1 text-[14px] text-ink-700">
                                      {lesson.title}
                                    </span>

                                    {lesson.isPreview && (
                                      <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700">
                                        Free
                                      </span>
                                    )}

                                    {lesson.duration > 0 && (
                                      <span className="shrink-0 text-[12px] text-ink-400">
                                        {formatDuration(lesson.duration)}
                                      </span>
                                    )}

                                    {isPreviewable && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewLesson(
                                            previewLesson?._id === lesson._id
                                              ? null
                                              : lesson
                                          )
                                        }
                                        className="shrink-0 text-[12px] font-semibold text-primary-600 hover:text-primary-700"
                                      >
                                        {previewLesson?._id === lesson._id
                                          ? 'Hide'
                                          : 'Preview'}
                                      </button>
                                    )}
                                  </div>

                                  {previewLesson?._id === lesson._id && (
                                    <div className="mt-3 space-y-3">
                                      {lesson.videoUrl && (
                                        <VideoEmbed
                                          url={lesson.videoUrl}
                                          title={lesson.title}
                                        />
                                      )}
                                      {lesson.content && (
                                        <p className="whitespace-pre-line text-[14px] text-ink-600">
                                          {lesson.content}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isEnrolled && !isOwner && course.totalLessons > 0 && (
                <p className="mt-4 text-[13px] text-ink-400">
                  Enrol to unlock every lesson.
                </p>
              )}
            </div>
          )}

          {/* -------------------------------------------------- Reviews tab */}
          {activeTab === 'reviews' && (
            <div role="tabpanel" className="pt-7">
              <CourseReviews
                courseId={course._id}
                onRatingChange={({ averageRating, totalReviews }) =>
                  setCourse((prev) =>
                    prev ? { ...prev, averageRating, totalReviews } : prev
                  )
                }
              />
            </div>
          )}
        </div>

        {/* --------------------------------------------------------- Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-card border border-ink-100 bg-white">
            <div className="relative aspect-[16/10] bg-bone">
              {course.thumbnail ? (
                <Image
                  src={course.thumbnail}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="336px"
                  unoptimized
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-3xl"
                  aria-hidden="true"
                >
                  🏋️
                </span>
              )}
            </div>

            <div className="p-5">
              <p className="display text-3xl">{formatPrice(course.price)}</p>

              {isOwner ? (
                <div className="mt-4 space-y-2">
                  <Link
                    href={`/trainer/courses/${course._id}/edit`}
                    className="btn btn-dark w-full"
                  >
                    Edit course
                  </Link>
                  <Link
                    href="/trainer/analytics"
                    className="btn btn-outline btn-sm w-full"
                  >
                    View analytics
                  </Link>
                </div>
              ) : isAdmin ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-md border border-ink-200 bg-bone px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-ink-900">
                      Reviewing as admin
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                      Admin accounts cannot enrol. You can already read every lesson
                      for moderation.
                    </p>
                  </div>
                  <Link href="/admin/users" className="btn btn-outline btn-sm w-full">
                    Open admin panel
                  </Link>
                </div>
              ) : isEnrolled ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-[13px] font-medium text-accent-700">
                    <Icon name="check" />
                    You are enrolled
                  </div>

                  {progress && progress.totalLessons > 0 && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[12px] text-ink-500">
                        <span>
                          {progress.completedLessons} of {progress.totalLessons} complete
                        </span>
                        <span className="font-semibold text-ink-900">
                          {progress.percent}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-ink-100"
                        role="progressbar"
                        aria-valuenow={progress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Course progress"
                      >
                        <div
                          className="h-full rounded-full bg-primary-600 transition-all"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/courses/${course._id}/learn`}
                    className="btn btn-primary w-full"
                  >
                    {progress?.completedLessons > 0
                      ? 'Continue learning'
                      : 'Start learning'}
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={enroll}
                    disabled={isEnrolling}
                    className="btn btn-primary w-full"
                  >
                    {isEnrolling
                      ? 'Starting…'
                      : course.price === 0
                        ? 'Enrol for free'
                        : `Enrol now — ${formatPrice(course.price)}`}
                  </button>

                  {previewLessons.length > 0 && (
                    <button
                      type="button"
                      onClick={openFirstPreview}
                      className="btn btn-outline w-full"
                    >
                      Try free preview
                    </button>
                  )}

                  <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-ink-400">
                    <Icon name="lock" />
                    {course.price === 0
                      ? 'No payment needed. Instant access.'
                      : 'Secure checkout via Stripe · Lifetime access'}
                  </p>
                  {!user && (
                    <p className="text-center text-[11px] text-ink-400">
                      You will be asked to sign in first.
                    </p>
                  )}
                </div>
              )}

              <dl className="mt-5 divide-y divide-ink-100 border-t border-ink-100 pt-1">
                {course.totalDuration > 0 && (
                  <SpecRow
                    label="Duration"
                    value={formatDuration(course.totalDuration)}
                  />
                )}
                <SpecRow label="Lessons" value={`${course.totalLessons} on-demand`} />
                <SpecRow label="Level" value={course.level} />
                <SpecRow
                  label="Students"
                  value={(course.totalEnrollments || 0).toLocaleString('en-US')}
                />
                <SpecRow
                  label="Rating"
                  value={
                    course.totalReviews > 0
                      ? `★ ${course.averageRating.toFixed(1)} (${course.totalReviews})`
                      : '—'
                  }
                />
              </dl>
            </div>
          </div>

          {/* Small trainer card, mirroring the mockup's secondary panel. */}
          {course.trainer && (
            <div className="mt-4 flex items-center gap-3 rounded-card border border-ink-100 bg-white p-4">
              <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary-100">
                {course.trainer.avatar ? (
                  <Image
                    src={course.trainer.avatar}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="36px"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary-700">
                    {course.trainer.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink-500">Taught by</p>
                <p className="truncate text-[13px] font-semibold text-ink-900">
                  {course.trainer.name}
                </p>
              </div>
              {isEnrolled && (
                <Link
                  href={`/chat?courseId=${course._id}&userId=${course.trainer._id}`}
                  className="btn btn-outline btn-sm shrink-0"
                >
                  Message
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function CourseDetail() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="spinner h-10 w-10" />
        </div>
      }
    >
      <CourseDetailBody />
    </Suspense>
  );
}
