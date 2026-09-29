'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AdminGuard from '@/components/AdminGuard';

function AdminPanelContent() {
  const { user } = useAuth();

  const [requestCounts, setRequestCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [userCounts, setUserCounts] = useState({
    customer: 0,
    trainer: 0,
    admin: 0,
    suspended: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const [requestsRes, usersRes] = await Promise.all([
          fetch('/api/admin/trainer-requests?status=pending'),
          fetch('/api/admin/users?limit=1'),
        ]);

        const [requestsData, usersData] = await Promise.all([
          requestsRes.json(),
          usersRes.json(),
        ]);

        if (cancelled) return;
        if (requestsData.success) setRequestCounts(requestsData.counts);
        if (usersData.success) setUserCounts(usersData.counts);
      } catch (error) {
        // The panel is still usable without the summary numbers.
        console.error('Failed to load admin stats:', error);
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalUsers = userCounts.customer + userCounts.trainer + userCounts.admin;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-600 mt-1">
          Signed in as {user.name}. Review trainer applications and manage users.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Applications pending</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {requestCounts.pending}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total users</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Trainers</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">
            {userCounts.trainer}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Suspended accounts</p>
          <p className="text-3xl font-bold text-red-600 mt-1">
            {userCounts.suspended}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/trainer-requests"
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between">
            <span className="text-3xl mb-3 block">📋</span>
            {requestCounts.pending > 0 && (
              <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
                {requestCounts.pending} waiting
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
            Trainer Applications
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Review documents, then approve with notes to promote applicants to
            trainers
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between">
            <span className="text-3xl mb-3 block">👥</span>
            {userCounts.suspended > 0 && (
              <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                {userCounts.suspended} suspended
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
            Manage Users
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Search accounts, change roles between customer and trainer, and
            suspend access
          </p>
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminPanelContent />
    </AdminGuard>
  );
}
