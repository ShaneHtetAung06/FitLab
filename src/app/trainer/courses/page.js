'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import TrainerGuard from '@/components/TrainerGuard';
import TrainerPanelTabs from '@/components/TrainerPanelTabs';
import { formatPrice, formatDuration } from '@/lib/courseOptions';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function TrainerCoursesContent() {
  const [courses, setCourses] = useState([]);
  const [counts, setCounts] = useState({ published: 0, draft: 0, all: 0 });
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ mine: '1', limit: '50' });
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/courses?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setCourses(data.courses);
        if (data.counts) setCounts(data.counts);
      } else {
        toast.error(data.message || 'Could not load your courses');
      }
    } catch (error) {
      toast.error('Could not load your courses');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const togglePublish = async (course) => {
    setActingOn(course._id);

    try {
      const res = await fetch(`/api/courses/${course._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !course.isPublished }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(course.isPublished ? 'Course unpublished' : 'Course published');
        await fetchCourses();
      } else {
        toast.error(data.message || 'Could not update the course');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setActingOn(null);
    }
  };

  const remove = async (course) => {
    setActingOn(course._id);

    try {
      const res = await fetch(`/api/courses/${course._id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setConfirmingDelete(null);
        await fetchCourses();
      } else {
        toast.error(data.message || 'Could not delete the course');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Trainer panel</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">My Courses</h1>
          <p className="mt-1.5 text-[15px] text-ink-500">
            Create, edit and publish the courses you offer on FitLab.
          </p>
        </div>

        <Link href="/trainer/courses/create" className="btn btn-primary btn-sm">
          <span aria-hidden="true">+</span> New course
        </Link>
      </div>

      <TrainerPanelTabs active="/trainer/courses" />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Course status">
        {FILTERS.map((item) => {
          const isActive = filter === item.key;
          const count = item.key === 'all' ? counts.all : counts[item.key];

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
                {count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="spinner h-10 w-10" />
        </div>
      ) : courses.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <h2 className="display text-xl">
            {filter === 'all'
              ? 'No courses yet'
              : `No ${filter === 'draft' ? 'drafts' : 'published courses'}`}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            {filter === 'all'
              ? 'Build your first course and start earning from your training.'
              : 'Try a different filter to see your other courses.'}
          </p>
          {filter === 'all' && (
            <Link href="/trainer/courses/create" className="btn btn-primary btn-sm mt-5">
              Create your first course
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {courses.map((course) => {
            const isBusy = actingOn === course._id;
            const isConfirming = confirmingDelete === course._id;

            return (
              <li key={course._id} className="card p-4 sm:p-5">
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
                        className="object-cover"
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
                      <h2 className="font-display text-lg font-bold text-ink-900">
                        {course.title}
                      </h2>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          course.isPublished
                            ? 'bg-accent-50 text-accent-700'
                            : 'bg-ink-100 text-ink-600'
                        }`}
                      >
                        {course.isPublished ? 'Live' : 'Draft'}
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-500">
                      {course.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
                      <span className="font-display text-sm font-bold text-ink-900">
                        {formatPrice(course.price)}
                      </span>
                      <span>{course.category}</span>
                      <span>{course.level}</span>
                      <span>
                        {course.totalLessons} lesson
                        {course.totalLessons === 1 ? '' : 's'}
                      </span>
                      {course.totalDuration > 0 && (
                        <span>{formatDuration(course.totalDuration)}</span>
                      )}
                      <span>{course.totalEnrollments || 0} enrolled</span>
                      {course.totalReviews > 0 && (
                        <span>
                          <span className="text-primary-600" aria-hidden="true">
                            ★
                          </span>{' '}
                          {course.averageRating?.toFixed(1)} ({course.totalReviews})
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] text-ink-400">
                      Updated {formatDate(course.updatedAt)}
                    </p>

                    {isConfirming ? (
                      <div className="mt-4 rounded-md border border-primary-200 bg-primary-50 p-3">
                        <p className="text-[13px] font-semibold text-primary-800">
                          Delete “{course.title}”? This cannot be undone.
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => remove(course)}
                            className="btn btn-primary btn-sm"
                          >
                            {isBusy ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(null)}
                            className="text-[13px] font-medium text-ink-600 hover:text-ink-900"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/trainer/courses/${course._id}/edit`}
                          className="btn btn-dark btn-sm"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => togglePublish(course)}
                          className="btn btn-outline btn-sm"
                        >
                          {isBusy
                            ? 'Saving…'
                            : course.isPublished
                              ? 'Unpublish'
                              : 'Publish'}
                        </button>
                        <Link
                          href={`/courses/${course._id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(course._id)}
                          className="ml-auto text-[13px] font-medium text-ink-400 transition-colors hover:text-primary-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function TrainerCoursesPage() {
  return (
    <TrainerGuard>
      <TrainerCoursesContent />
    </TrainerGuard>
  );
}
