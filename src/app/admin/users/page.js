'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import AdminGuard from '@/components/AdminGuard';

const ROLE_FILTERS = [
  { key: 'all', label: 'All roles' },
  { key: 'customer', label: 'Customers' },
  { key: 'trainer', label: 'Trainers' },
  { key: 'admin', label: 'Admins' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All statuses' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
];

const ROLE_BADGES = {
  customer: 'bg-gray-100 text-gray-700',
  trainer: 'bg-primary-100 text-primary-700',
  admin: 'bg-purple-100 text-purple-700',
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function AdminUsersContent() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({
    customer: 0,
    trainer: 0,
    admin: 0,
    suspended: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        role,
        status,
        page: String(page),
      });

      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.users);
        setCounts(data.counts);
        setPagination(data.pagination);
      } else {
        toast.error(data.message || 'Could not load users');
      }
    } catch (error) {
      toast.error('Could not load users');
    } finally {
      setIsLoading(false);
    }
  }, [role, status, page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUser = async (target, updates, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setActingOn(target._id);

    try {
      const res = await fetch(`/api/admin/users/${target._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        // Patch the row in place so the current page and filters are preserved.
        setUsers((prev) =>
          prev.map((item) => (item._id === data.user._id ? data.user : item))
        );
        // Role and suspension both affect the summary counts.
        fetchUsers();
      } else {
        toast.error(data.message || 'Could not update the user');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
      >
        ← Back to admin panel
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
        <p className="text-gray-600 mt-1">
          Change roles and suspend accounts. Admin accounts are managed directly
          in the database.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{counts.customer}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Trainers</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">{counts.trainer}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Admins</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{counts.admin}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Suspended</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{counts.suspended}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label htmlFor="search" className="sr-only">
            Search users
          </label>
          <input
            id="search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="role-filter"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white"
          >
            {ROLE_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <span className="text-4xl block mb-3" aria-hidden="true">
            🔍
          </span>
          <h2 className="text-lg font-semibold text-gray-900">No users found</h2>
          <p className="text-gray-600 mt-1">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">
                Registered users with role and status controls
              </caption>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-4 py-3 text-sm font-semibold text-gray-700">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((item) => {
                  const isSelf = item._id === currentUser?._id;
                  const isAdminRow = item.role === 'admin';
                  const isBusy = actingOn === item._id;
                  // Admins are provisioned in the database, so the panel leaves
                  // them and the acting admin's own row alone.
                  const isLocked = isSelf || isAdminRow;

                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-primary-600 font-semibold text-sm">
                              {item.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {item.name}
                              {isSelf && (
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{item.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                            ROLE_BADGES[item.role] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 text-sm text-accent-700">
                            <span aria-hidden="true">●</span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-red-600">
                            <span aria-hidden="true">●</span> Suspended
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        {isLocked ? (
                          <span className="text-sm text-gray-400">
                            {isSelf ? 'Your account' : 'Managed in database'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <label
                              htmlFor={`role-${item._id}`}
                              className="sr-only"
                            >
                              Change role for {item.name}
                            </label>
                            <select
                              id={`role-${item._id}`}
                              value={item.role}
                              disabled={isBusy}
                              onChange={(e) =>
                                updateUser(
                                  item,
                                  { role: e.target.value },
                                  `Change ${item.name}'s role to ${e.target.value}?`
                                )
                              }
                              className="text-sm px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
                            >
                              <option value="customer">customer</option>
                              <option value="trainer">trainer</option>
                            </select>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                updateUser(
                                  item,
                                  { isActive: !item.isActive },
                                  item.isActive
                                    ? `Suspend ${item.name}? They will be signed out and unable to log in.`
                                    : null
                                )
                              }
                              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                                item.isActive
                                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                                  : 'border-accent-200 text-accent-700 hover:bg-accent-50'
                              }`}
                            >
                              {item.isActive ? 'Suspend' : 'Reactivate'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total}{' '}
              user{pagination.total === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((prev) => prev + 1)}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminUsersContent />
    </AdminGuard>
  );
}
