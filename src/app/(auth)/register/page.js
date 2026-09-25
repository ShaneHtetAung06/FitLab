'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import PasswordField from '@/components/PasswordField';
import toast from 'react-hot-toast';

function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get('callbackUrl');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    const result = await register(name, email, password, callbackUrl);

    if (!result.success) {
      toast.error(result.message || 'Registration failed');
    } else {
      toast.success('Account created');
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-bone px-4 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="eyebrow">Get started</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">Create your account</h1>
          <p className="mt-2 text-[15px] text-ink-500">
            Free to join. Pay only for the courses you take.
          </p>
        </div>

        <div className="card mt-8 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-[13px] font-medium text-ink-700"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field"
                placeholder="Alex Carter"
              />
            </div>

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
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />

            <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-ink-500">
            Already have an account?{' '}
            <Link
              href={
                callbackUrl
                  ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : '/login'
              }
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[12px] text-ink-400">
          Want to teach on FitLab? Create an account first, then apply from your
          dashboard.
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  // useSearchParams needs a Suspense boundary during prerendering.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="spinner h-10 w-10" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
