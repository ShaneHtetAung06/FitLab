'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import TrainerGuard from '@/components/TrainerGuard';
import TrainerPanelTabs from '@/components/TrainerPanelTabs';
import TrendChart from '@/components/TrendChart';
import { formatPrice, formatDuration } from '@/lib/courseOptions';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

const METRICS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'enrollments', label: 'Enrollments' },
];

function StatCard({ label, value, delta, hint }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
        {label}
      </p>
      <p className="display mt-2 text-2xl sm:text-[1.75rem]">{value}</p>
      {delta ? (
        <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-accent-600">
          <span aria-hidden="true">↑</span>
          {delta}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function TrainerAnalyticsContent() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('revenue');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/trainer/analytics?days=${days}`);
      const payload = await res.json();

      if (payload.success) {
        setData(payload);
      } else {
        toast.error(payload.message || 'Could not load your analytics');
      }
    } catch (error) {
      toast.error('Could not load your analytics');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (!data) return null;

  const { totals, timeseries, courses, topCourses, recentEnrollments, ratingBreakdown } =
    data;

  const activeMetric = METRICS.find((item) => item.key === metric) || METRICS[0];

  const chartData = timeseries.map((point) => ({
    date: point.date,
    value: point[metric],
  }));

  const maxRatingCount = Math.max(
    1,
    ...Object.values(ratingBreakdown || {}).map((count) => Number(count) || 0)
  );

  const published = totals.publishedCourses;
  const drafts = totals.draftCourses;
  const hasAnySales = totals.enrollments > 0;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Trainer panel</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-400">{today}</p>
        </div>

        <Link href="/trainer/courses/create" className="btn btn-primary btn-sm">
          <span aria-hidden="true">+</span> New course
        </Link>
      </div>

      <TrainerPanelTabs active="/trainer/analytics" />

      {/* Lifetime stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatPrice(totals.revenue)}
          delta={
            totals.rangeRevenue > 0
              ? `${formatPrice(totals.rangeRevenue)} in ${days} days`
              : null
          }
          hint={`Nothing in the last ${days} days`}
        />
        <StatCard
          label="Total students"
          value={totals.uniqueLearners.toLocaleString('en-US')}
          delta={
            totals.rangeEnrollments > 0
              ? `+${totals.rangeEnrollments} in ${days} days`
              : null
          }
          hint={`${totals.enrollments} enrollment${
            totals.enrollments === 1 ? '' : 's'
          } all time`}
        />
        <StatCard
          label="Active courses"
          value={published}
          hint={
            drafts > 0
              ? `${drafts} draft${drafts === 1 ? '' : 's'} pending`
              : 'All courses published'
          }
        />
        <StatCard
          label="Avg rating"
          value={
            totals.totalReviews > 0 ? `★ ${totals.averageRating.toFixed(1)}` : '—'
          }
          hint={`From ${totals.totalReviews} review${
            totals.totalReviews === 1 ? '' : 's'
          }`}
        />
      </div>

      {/* Trend */}
      <section className="card mt-6 p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-lg">
            {activeMetric.label}{' '}
            <span className="font-normal text-ink-400">
              (last {days === 365 ? '12 months' : `${days} days`})
            </span>
          </h2>

          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1.5" role="tablist" aria-label="Metric">
              {METRICS.map((item) => {
                const isActive = metric === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setMetric(item.key)}
                    className={`pill ${isActive ? 'pill-active' : ''}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <span className="mx-1 hidden w-px bg-ink-100 sm:block" aria-hidden="true" />

            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Date range">
              {RANGES.map((range) => {
                const isActive = days === range.days;
                return (
                  <button
                    key={range.days}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setDays(range.days)}
                    className={`pill ${isActive ? 'pill-active' : ''}`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <TrendChart
          data={chartData}
          label={activeMetric.label}
          format={
            metric === 'revenue'
              ? (value) => formatPrice(value)
              : (value) => String(Math.round(value))
          }
        />
      </section>

      {/* Recent enrollments + top courses */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="display text-lg">Recent enrollments</h2>
            {recentEnrollments.length > 0 && (
              <span className="text-[12px] text-ink-400">
                {recentEnrollments.length} shown
              </span>
            )}
          </div>

          {recentEnrollments.length === 0 ? (
            <p className="text-sm text-ink-500">
              Nobody has enrolled yet. Share your published courses to get started.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentEnrollments.map((enrollment) => (
                <li key={enrollment._id} className="flex items-center gap-3 py-3">
                  <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary-50">
                    {enrollment.user?.avatar ? (
                      <Image
                        src={enrollment.user.avatar}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="36px"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary-700">
                        {enrollment.user?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink-900">
                      {enrollment.user?.name || 'A learner'}
                    </p>
                    <p className="truncate text-[12px] text-primary-600">
                      {enrollment.course?.title || 'Course'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold text-accent-600">
                      +{formatPrice(enrollment.amountPaid)}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {formatDate(enrollment.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <h2 className="display mb-4 text-lg">Your top courses</h2>

          {!hasAnySales ? (
            <p className="text-sm text-ink-500">
              No sales yet. Publish a course to start earning.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {topCourses
                .filter((course) => course.revenue > 0)
                .map((course) => (
                  <li key={course._id} className="flex items-center gap-3 py-3">
                    <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-[4px] bg-bone">
                      {course.thumbnail ? (
                        <Image
                          src={course.thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center text-sm"
                          aria-hidden="true"
                        >
                          🏋️
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/trainer/courses/${course._id}/edit`}
                        className="block truncate text-[13px] font-semibold text-ink-900 hover:text-primary-600"
                      >
                        {course.title}
                      </Link>
                      <p className="truncate text-[12px] text-ink-400">
                        {course.enrollments} student
                        {course.enrollments === 1 ? '' : 's'}
                        {course.totalReviews > 0 &&
                          ` · ★ ${course.averageRating.toFixed(1)}`}
                      </p>
                    </div>

                    <p className="shrink-0 font-display text-[15px] font-bold text-ink-900">
                      {formatPrice(course.revenue)}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* Performance table */}
      <section className="card mt-6 p-6">
        <h2 className="display mb-4 text-lg">Performance by course</h2>

        {courses.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-500">You have not created any courses yet.</p>
            <Link href="/trainer/courses/create" className="btn btn-primary btn-sm mt-4">
              Create your first course
            </Link>
          </div>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Revenue and enrollments for each of your courses
              </caption>
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th
                    scope="col"
                    className="pb-2 text-[10px] font-bold uppercase tracking-eyebrow text-ink-400"
                  >
                    Course
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right text-[10px] font-bold uppercase tracking-eyebrow text-ink-400"
                  >
                    Price
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right text-[10px] font-bold uppercase tracking-eyebrow text-ink-400"
                  >
                    Enrolled
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right text-[10px] font-bold uppercase tracking-eyebrow text-ink-400"
                  >
                    Revenue
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right text-[10px] font-bold uppercase tracking-eyebrow text-ink-400"
                  >
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {courses.map((course) => (
                  <tr key={course._id}>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/trainer/courses/${course._id}/edit`}
                        className="text-[13px] font-semibold text-ink-900 hover:text-primary-600"
                      >
                        {course.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            course.isPublished
                              ? 'bg-accent-50 text-accent-700'
                              : 'bg-ink-100 text-ink-600'
                          }`}
                        >
                          {course.isPublished ? 'Live' : 'Draft'}
                        </span>
                        <span className="text-[11px] text-ink-400">
                          {course.totalLessons} lesson
                          {course.totalLessons === 1 ? '' : 's'}
                          {course.totalDuration > 0 &&
                            ` · ${formatDuration(course.totalDuration)}`}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right text-[13px] text-ink-500">
                      {formatPrice(course.price)}
                    </td>
                    <td className="py-3 text-right text-[13px] font-semibold text-ink-900">
                      {course.enrollments}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right text-[13px] font-semibold text-ink-900">
                      {formatPrice(course.revenue)}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right text-[13px] text-ink-500">
                      {course.totalReviews > 0
                        ? `★ ${course.averageRating.toFixed(1)} (${course.totalReviews})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ratings */}
      <section className="card mt-6 p-6">
        <h2 className="display mb-4 text-lg">Rating breakdown</h2>

        {totals.totalReviews === 0 ? (
          <p className="text-sm text-ink-500">No reviews yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingBreakdown[star] || 0;
              const percent = Math.round((count / maxRatingCount) * 100);

              return (
                <li key={star} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-[12px] text-ink-500">{star} ★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[12px] text-ink-500">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {totals.refundedCount > 0 && (
        <p className="mt-4 text-[12px] text-ink-400">
          {totals.refundedCount} refunded enrollment
          {totals.refundedCount === 1 ? '' : 's'} ({formatPrice(totals.refundedAmount)})
          excluded from revenue.
        </p>
      )}
    </div>
  );
}

export default function TrainerAnalyticsPage() {
  return (
    <TrainerGuard>
      <TrainerAnalyticsContent />
    </TrainerGuard>
  );
}
