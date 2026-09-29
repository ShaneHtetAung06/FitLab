'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const HIDDEN_PREFIXES = ['/chat', '/admin'];

export default function Footer() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-800 bg-ink-900 text-ink-300">
      <div className="mx-auto max-w-shell px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white"
                aria-hidden="true"
              >
                F
              </span>
              <span className="text-lg font-bold tracking-tight text-white">FitLab</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
              Structured fitness education from trainers who have lived what they teach.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-eyebrow text-ink-500">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/courses"
                  className="link-sweep transition-colors hover:text-white"
                >
                  Browse courses
                </Link>
              </li>
              {user ? (
                <li>
                  <Link
                    href="/dashboard/enrollments"
                    className="link-sweep transition-colors hover:text-white"
                  >
                    My learning
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link
                      href="/register"
                      className="link-sweep transition-colors hover:text-white"
                    >
                      Create an account
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="link-sweep transition-colors hover:text-white"
                    >
                      Sign in
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-eyebrow text-ink-500">
              For trainers
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                {/* Points at the in-app application flow rather than a marketing
                    page, since becoming a trainer requires an account. */}
                <Link
                  href={user ? '/dashboard/become-trainer' : '/register'}
                  className="link-sweep transition-colors hover:text-white"
                >
                  Become a trainer
                </Link>
              </li>
              {user?.role === 'trainer' && (
                <>
                  <li>
                    <Link
                      href="/trainer/courses/create"
                      className="link-sweep transition-colors hover:text-white"
                    >
                      Create a course
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/trainer/analytics"
                      className="link-sweep transition-colors hover:text-white"
                    >
                      Analytics
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-eyebrow text-ink-500">
              Legal
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <span className="text-ink-400">Privacy policy</span>
              </li>
              <li>
                <span className="text-ink-400">Terms of service</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-ink-800 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} FitLab. All rights reserved.</p>
          <p>Payments secured by Stripe.</p>
        </div>
      </div>
    </footer>
  );
}
