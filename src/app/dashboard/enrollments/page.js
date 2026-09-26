'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Reveal from '@/components/Reveal';
import { formatPrice, formatDuration } from '@/lib/courseOptions';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function EnrollmentsPage() {
  const { user, loading: authLoading } = useAuth();

  const [enrollments, setEnrollments] = useState([]);
  const [counts, setCounts] = useState({ all: 0, inProgress: 0, completed: 0 });
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/enrollments');
      const data = await res.json();

      if (data.success) {
        setEnrollments(data.enrollments);
        setCounts(data.counts);
      } else {
        toast.error(data.message || 'Could not load your courses');
      }
    } catch (error) {
      toast.error('Could not load your courses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchEnrollments();
  }, [user, fetchEnrollments]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (!user) return null;

  const visible = enrollments.filter((item) => {
    if (filter === 'completed') return item.progress.isComplete;
    if (filter === 'inProgress') {
      return !item.progress.isComplete && item.status !== 'refunded';
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">My learning</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">Your Courses</h1>
          <p className="mt-1.5 text-[15px] text-ink-500">
            Pick up where you left off, or start something new.
          </p>
        </div>
        <Link href="/courses" className="btn btn-primary btn-sm">
          Browse courses
        </Link>
      </div>

      {enrollments.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter">
          {FILTERS.map((item) => {
            const isActive = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(item.key)}
                className={`pill ${isActive ? 'pill-active' : ''}`}
              >
                {item.label}
                <span className={isActive ? 'text-white/60' : 'text-ink-400'}>
                  {counts[item.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <Reveal className="card mt-8 p-12 text-center">
          <h2 className="display text-xl">
            {enrollments.length === 0
              ? 'You have not enrolled in a course yet'
              : 'Nothing here'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            {enrollments.length === 0
              ? 'Browse the catalogue and find a programme that suits your goals.'
              : 'Try a different filter.'}
          </p>
          {enrollments.length === 0 && (
            <Link href="/courses" className="btn btn-primary btn-sm mt-5">
              Browse courses
            </Link>
          )}
        </Reveal>
      ) : (
        <Reveal as="ul" stagger className="mt-8 space-y-4">
          {visible.map((item) => {
            const { course, progress } = item;
            const isRefunded = item.status === 'refunded';

            return (
              <li
                key={item._id}
                className="group card p-4 transition-[border-color,box-shadow] duration-300 ease-soft hover:border-ink-200 hover:shadow-lift sm:p-5"
              >
                <div className="flex flex-col gap-5 sm:flex-row">
                  <Link
                    href={`/courses/${course._id}`}
                    className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-[6px] bg-bone sm:w-52"
                  >
                    {course.thumbnail ? (
                      <Image
                        src={course.thumbnail}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-[600ms] ease-soft group-hover:scale-105"
                        sizes="208px"
                        unoptimized
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-2xl"
                        aria-hidden="true"
                      >
                        🏋️
                      </span>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-primary-600">
                          {course.category}
                        </p>
                        <h2 className="mt-0.5 font-display text-lg font-bold text-ink-900">
                          <Link
                            href={`/courses/${course._id}`}
                            className="transition-colors hover:text-primary-600"
                          >
                            {course.title}
                          </Link>
                        </h2>
                        {course.trainer?.name && (
                          <p className="text-[13px] text-ink-500">
                            by {course.trainer.name}
                          </p>
                        )}
                      </div>

                      {isRefunded ? (
                        <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-600">
                          Refunded
                        </span>
                      ) : progress.isComplete ? (
                        <span className="shrink-0 rounded-full bg-accent-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700">
                          Completed
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                          In progress
                        </span>
                      )}
                    </div>

                    {!isRefunded && (
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-[12px] text-ink-500">
                          <span>
                            {progress.completedLessons} of {progress.totalLessons} lesson
                            {progress.totalLessons === 1 ? '' : 's'}
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
                          aria-label={`Progress in ${course.title}`}
                        >
                          {/* Fills from empty the first time the row is drawn,
                              then transitions normally as lessons complete. */}
                          <div
                            className={`bar-fill h-full rounded-full transition-all ${
                              progress.isComplete ? 'bg-accent-500' : 'bg-primary-600'
                            }`}
                            style={{
                              '--bar-width': `${progress.percent}%`,
                              width: `${progress.percent}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-400">
                      <span>Enrolled {formatDate(item.createdAt)}</span>
                      <span>Paid {formatPrice(item.amountPaid)}</span>
                      {course.totalDuration > 0 && (
                        <span>{formatDuration(course.totalDuration)}</span>
                      )}
                      {course.totalReviews > 0 && (
                        <span>
                          <span className="text-primary-600" aria-hidden="true">
                            ★
                          </span>{' '}
                          {course.averageRating?.toFixed(1)} ({course.totalReviews})
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {isRefunded ? (
                        <Link
                          href={`/courses/${course._id}`}
                          className="btn btn-outline btn-sm"
                        >
                          View course
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/courses/${course._id}/learn`}
                            className="btn btn-primary btn-sm"
                          >
                            {progress.completedLessons === 0
                              ? 'Start learning'
                              : progress.isComplete
                                ? 'Review lessons'
                                : 'Continue'}
                          </Link>
                          <Link
                            href={`/courses/${course._id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            Course page
                          </Link>
                          {course.trainer?._id && (
                            <Link
                              href={`/chat?courseId=${course._id}&userId=${course.trainer._id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              Message trainer
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </Reveal>
      )}
    </div>
  );
}
