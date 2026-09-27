'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

/**
 * Wraps trainer pages with a role check.
 *
 * Like AdminGuard this is a usability guard rather than a security boundary:
 * middleware only confirms a token cookie exists, so the real enforcement lives
 * in the course API routes via authorizeRequest(request, 'trainer', 'admin').
 */
export default function TrainerGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Middleware already redirected unauthenticated visitors to /login.
  if (!user) return null;

  if (user.role !== 'trainer' && user.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-4xl block mb-3" aria-hidden="true">
          🏋️
        </span>
        <h1 className="text-2xl font-bold text-gray-900">Trainers only</h1>
        <p className="text-gray-600 mt-1">
          You need an approved trainer account to create and manage courses.
        </p>
        <div className="flex items-center justify-center gap-4 mt-5">
          <Link
            href="/dashboard/become-trainer"
            className="bg-primary-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Apply to become a trainer
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
