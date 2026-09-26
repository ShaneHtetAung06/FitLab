'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import CountUp from '@/components/CountUp';
import Reveal from '@/components/Reveal';

function ActionCard({ href, title, body, accent = false }) {
  return (
    <Link
      href={href}
  
      className={`group flex flex-col justify-between rounded-card border p-5 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-lift ${
        accent
          ? 'border-ink-900 bg-ink-900 hover:bg-ink-800'
          : 'border-ink-100 bg-white hover:border-ink-300'
      }`}
    >
      <div>
        <h2
          className={`font-display text-lg font-bold ${
            accent ? 'text-white' : 'text-ink-900'
          }`}
        >
          {title}
        </h2>
        <p className={`mt-1.5 text-[13px] ${accent ? 'text-ink-300' : 'text-ink-500'}`}>
          {body}
        </p>
      </div>
      <span
        className={`mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold ${
          accent ? 'text-white' : 'text-primary-600'
        }`}
      >
        Open
        <span
          className="transition-transform duration-300 ease-soft group-hover:translate-x-1"
          aria-hidden="true"
        >
          →
        </span>
      </span>
    </Link>
  );
}

function Stat({ value, label }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
        {label}
      </p>
      <p className="display mt-1.5 text-2xl">
        <CountUp value={value} duration={900} />
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [counts, setCounts] = useState(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/enrollments');
      const data = await res.json();
      if (data.success) setCounts(data.counts);
    } catch (error) {
      // The dashboard is still useful without the summary, so this stays quiet.
    }
  }, []);

  useEffect(() => {
    // Trainers and admins have their own panels; these numbers are a learner's.
    if (!user || user.role === 'admin') return;
    fetchCounts();
  }, [user, fetchCounts]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  // Middleware already redirected unauthenticated visitors.
  if (!user) return null;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div>
        <p className="eyebrow">
          {user.role === 'trainer'
            ? 'Trainer account'
            : user.role === 'admin'
              ? 'Admin account'
              : 'Your account'}
        </p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">
          Welcome back, {user.name.split(' ')[0]}.
        </h1>
        <p className="mt-1.5 text-[13px] text-ink-400">{today}</p>
      </div>

      {counts && (
        <Reveal stagger className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat value={counts.all} label="Courses enrolled" />
          <Stat value={counts.inProgress} label="In progress" />
          <Stat value={counts.completed} label="Completed" />
        </Reveal>
      )}

      <Reveal stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          href="/dashboard/enrollments"
          title="My learning"
          body="Pick up where you left off and track your progress."
        />
        <ActionCard
          href="/courses"
          title="Browse courses"
          body="Find a new programme from a verified trainer."
        />
        {user.role !== 'admin' && (
          <ActionCard
            href="/chat"
            title="Messages"
            body="Talk directly to the trainers behind your courses."
          />
        )}

        {user.role === 'customer' && (
          <ActionCard
            href="/dashboard/become-trainer"
            title="Become a trainer"
            body="Apply to publish your own courses on FitLab."
            accent
          />
        )}

        {user.role === 'trainer' && (
          <>
            <ActionCard
              href="/trainer/courses"
              title="My courses"
              body="Create, edit and publish what you offer."
            />
            <ActionCard
              href="/trainer/analytics"
              title="Trainer dashboard"
              body="Revenue, enrollments and ratings at a glance."
              accent
            />
          </>
        )}

        {user.role === 'admin' && (
          <ActionCard
            href="/admin"
            title="Admin panel"
            body="Manage users, courses and trainer requests."
            accent
          />
        )}
      </Reveal>

      <Reveal as="section" className="card mt-8 p-6">
        <h2 className="display text-lg">Account information</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
              Name
            </dt>
            <dd className="mt-1 text-[14px] text-ink-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
              Email
            </dt>
            <dd className="mt-1 break-all text-[14px] text-ink-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
              Role
            </dt>
            <dd className="mt-1 text-[14px] capitalize text-ink-900">{user.role}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
              Member since
            </dt>
            <dd className="mt-1 text-[14px] text-ink-900">
              {new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </dd>
          </div>
        </dl>

        <Link href="/dashboard/profile" className="btn btn-outline btn-sm mt-6">
          Edit profile
        </Link>
      </Reveal>
    </div>
  );
}
