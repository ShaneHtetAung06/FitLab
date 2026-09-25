'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function HomeCTAButtons() {
  const { user } = useAuth();

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      {!user ? (
        <Link href="/register" className="btn btn-primary">
          Create free account
        </Link>
      ) : (
        <Link href="/dashboard/enrollments" className="btn btn-primary">
          Go to my learning
        </Link>
      )}
      <Link
        href="/courses"
        className="btn border border-ink-700 text-white hover:border-white"
      >
        Browse the catalogue
      </Link>
    </div>
  );
}
