'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import TrainerGuard from '@/components/TrainerGuard';
import CourseForm from '@/components/CourseForm';
import { formatPrice } from '@/lib/courseOptions';

function EditCourseContent() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.id;

  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      const data = await res.json();

      if (data.success) {
        // Editing is only meaningful for the owner (or an admin); the API
        // reports who the viewer is so we can fail clearly instead of showing a
        // form whose save would be rejected.
        if (!data.access?.isOwner && !data.access?.isAdmin) {
          setLoadError('You can only edit your own courses.');
        } else {
          setCourse(data.course);
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

  const handleSubmit = async ({ payload }) => {
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        router.push('/trainer/courses');
        return true;
      }

      toast.error(data.message || 'Could not save your changes');
      return false;
    } catch (error) {
      toast.error('Something went wrong');
      return false;
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete "${course.title}"? This cannot be undone and is only possible while no one has enrolled.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        router.push('/trainer/courses');
      } else {
        toast.error(data.message || 'Could not delete the course');
      }
    } catch (error) {
      toast.error('Something went wrong');
    }
  };

  if (isLoading) {
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
          href="/trainer/courses"
          className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-semibold"
        >
          Back to my courses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/trainer/courses"
        className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
      >
        ← Back to my courses
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Course</h1>
          <p className="text-gray-600 mt-1">{course.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-sm font-medium rounded-full ${
              course.isPublished
                ? 'bg-accent-100 text-accent-700'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            <span aria-hidden="true">{course.isPublished ? '✅' : '📝'}</span>
            {course.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>

      {course.totalEnrollments > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-primary-900">
            <span aria-hidden="true">👥</span>{' '}
            <strong>
              {course.totalEnrollments} learner
              {course.totalEnrollments === 1 ? '' : 's'}
            </strong>{' '}
            already enrolled at {formatPrice(course.price)}. Existing lessons keep
            their place when you edit, so their progress is preserved. Changing the
            price only affects new purchases.
          </p>
        </div>
      )}

      <CourseForm
        course={course}
        onSubmit={handleSubmit}
        submitLabel="Save as draft"
        onDelete={handleDelete}
      />
    </div>
  );
}

export default function EditCoursePage() {
  return (
    <TrainerGuard>
      <EditCourseContent />
    </TrainerGuard>
  );
}
