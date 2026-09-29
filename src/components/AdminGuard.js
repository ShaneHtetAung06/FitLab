'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

/**
 * Wraps admin pages with a role check.
 *
 * This is a usability guard, not a security boundary: middleware only verifies
 * that a token cookie exists, so the real enforcement lives in the admin API
 * routes via authorizeRequest(request, 'admin').
 */
export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Middleware already redirected unauthenticated visitors to /admin/login.
  if (!user) return null;

  if (user.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <span className="text-4xl block mb-3" aria-hidden="true">
          🔒
        </span>
        <h1 className="text-2xl font-bold text-gray-900">Admins only</h1>
        <p className="text-gray-600 mt-1">
          You do not have permission to view this area.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-semibold"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return children;
}
