'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import TrainerGuard from '@/components/TrainerGuard';
import CourseForm from '@/components/CourseForm';

function CreateCourseContent() {
  const router = useRouter();

  const handleSubmit = async ({ payload }) => {
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        router.push('/trainer/courses');
        return true;
      }

      toast.error(data.message || 'Could not create the course');
      return false;
    } catch (error) {
      toast.error('Something went wrong');
      return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/trainer/courses"
        className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
      >
        ← Back to my courses
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create a Course</h1>
        <p className="text-gray-600 mt-1">
          Save it as a draft while you work, then publish when it is ready.
        </p>
      </div>

      <CourseForm onSubmit={handleSubmit} submitLabel="Save as draft" />
    </div>
  );
}

export default function CreateCoursePage() {
  return (
    <TrainerGuard>
      <CreateCourseContent />
    </TrainerGuard>
  );
}
