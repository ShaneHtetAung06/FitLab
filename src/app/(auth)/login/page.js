'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import PasswordField from '@/components/PasswordField';
import toast from 'react-hot-toast';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const searchParams = useSearchParams();


  const callbackUrl = searchParams.get('callbackUrl');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    const result = await login(email, password, callbackUrl);

    if (!result.success) {
      toast.error(result.message || 'Login failed');
    } else {
      toast.success('Welcome back');
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-bone px-4 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="eyebrow">Welcome back</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-[15px] text-ink-500">
            Continue where you left off.
          </p>
        </div>

        <div className="card mt-8 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[13px] font-medium text-ink-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
                placeholder="you@example.com"
              />
            </div>

            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-ink-500">
            Don&apos;t have an account?{' '}
            <Link
              href={
                callbackUrl
                  ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : '/register'
              }
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[12px] text-ink-400">
          Administrators sign in through the{' '}
          <Link href="/admin/login" className="underline hover:text-ink-700">
            admin portal
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during prerendering.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="spinner h-10 w-10" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
