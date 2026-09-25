'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import AdminGuard from '@/components/AdminGuard';
import {
  isPdfDocument,
  documentViewUrl,
  documentPreviewUrl,
} from '@/lib/documents';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function AdminTrainerRequestsContent() {
  const { checkAuth } = useAuth();

  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);

  // id of the request currently being approved/rejected
  const [actingOn, setActingOn] = useState(null);
  // id of the request whose reject form is open
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState({});

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/trainer-requests?status=${filter}`);
      const data = await res.json();

      if (data.success) {
        setRequests(data.requests);
        setCounts(data.counts);
      } else {
        toast.error(data.message || 'Could not load applications');
      }
    } catch (error) {
      toast.error('Could not load applications');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const review = async (id, action, adminNotes = '') => {
    setActingOn(id);

    try {
      const res = await fetch(`/api/admin/trainer-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNotes }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setRejectingId(null);
        setRejectNotes('');
        await fetchRequests();
        // An admin can approve their own pending application in theory, so keep
        // the cached user in sync.
        checkAuth();
      } else {
        toast.error(data.message || 'Could not update the application');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
      >
        ← Back to admin panel
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Trainer Applications</h1>
        <p className="text-gray-600 mt-1">
          Review submitted documents and approve applicants to promote them to
          trainers.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {FILTERS.map((item) => {
          const isActive = filter === item.key;
          const count =
            item.key === 'all'
              ? counts.pending + counts.approved + counts.rejected
              : counts[item.key];

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(item.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
              }`}
            >
              {item.label}
              <span
                className={`ml-2 ${isActive ? 'text-primary-100' : 'text-gray-400'}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <span className="text-4xl block mb-3" aria-hidden="true">
            📭
          </span>
          <h2 className="text-lg font-semibold text-gray-900">
            No {filter === 'all' ? '' : filter} applications
          </h2>
          <p className="text-gray-600 mt-1">
            {filter === 'pending'
              ? 'Nothing is waiting for review right now.'
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((item) => {
            const applicant = item.user || {};
            const isBusy = actingOn === item._id;
            const isRejecting = rejectingId === item._id;

            return (
              <li
                key={item._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                {/* Applicant header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-primary-600 font-semibold">
                        {applicant.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {applicant.name || 'Deleted user'}
                      </p>
                      <p className="text-sm text-gray-500">{applicant.email}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <StatusBadge status={item.status} />
                    <p className="text-xs text-gray-500 mt-1">
                      Applied {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Application detail */}
                <dl className="grid sm:grid-cols-2 gap-4 mt-5">
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">
                      Qualifications
                    </dt>
                    <dd className="text-gray-900 whitespace-pre-line">
                      {item.qualifications}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Experience</dt>
                    <dd className="text-gray-900 whitespace-pre-line">
                      {item.experience}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Specialties</dt>
                    <dd className="text-gray-900">{item.specialties}</dd>
                  </div>
                </dl>

                {/* Documents */}
                <div className="mt-5">
                  <p className="text-sm font-medium text-gray-500 mb-2">
                    Documents ({item.documents?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {(item.documents || []).map((doc) => {
                      const isPdf = isPdfDocument(doc);

                      return (
                        <a
                          key={doc.publicId}
                          href={documentViewUrl(doc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block w-28"
                          title={doc.name}
                        >
                          <div className="relative w-28 h-28 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden group-hover:border-primary-400 transition-colors">
                            {/* PDFs are shown as a rendered first page, which is
                                far more useful for verifying a certificate than
                                a generic file icon. */}
                            <Image
                              src={documentPreviewUrl(doc)}
                              alt={doc.name || 'Certificate'}
                              width={112}
                              height={112}
                              className="w-28 h-28 object-cover"
                              unoptimized
                            />
                            {isPdf && (
                              <span
                                className="absolute bottom-1 right-1 text-[10px] font-semibold bg-gray-900/75 text-white px-1.5 py-0.5 rounded"
                                aria-hidden="true"
                              >
                                PDF
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 truncate group-hover:text-primary-600">
                            {doc.name || 'Document'}
                          </p>
                        </a>
                      );
                    })}
                  </div>
                </div>

                {/* Review outcome for already-decided applications */}
                {item.status !== 'pending' && (
                  <div className="mt-5 pt-5 border-t border-gray-100 text-sm text-gray-600">
                    <p>
                      Reviewed by{' '}
                      <span className="font-medium text-gray-900">
                        {item.reviewedBy?.name || 'an admin'}
                      </span>{' '}
                      on {formatDate(item.reviewedAt)}
                    </p>
                    {item.adminNotes && (
                      <p className="mt-1">
                        <span className="font-medium text-gray-900">Notes:</span>{' '}
                        {item.adminNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {item.status === 'pending' && (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    {isRejecting ? (
                      <div className="space-y-3">
                        <label
                          htmlFor={`reject-notes-${item._id}`}
                          className="block text-sm font-medium text-gray-700"
                        >
                          Reason for rejection (shared with the applicant)
                        </label>
                        <textarea
                          id={`reject-notes-${item._id}`}
                          rows={3}
                          maxLength={1000}
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                          placeholder="Explain what is missing or unclear"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={isBusy || !rejectNotes.trim()}
                            onClick={() => review(item._id, 'reject', rejectNotes)}
                            className="bg-red-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isBusy ? 'Rejecting...' : 'Confirm rejection'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectNotes('');
                            }}
                            className="text-gray-600 hover:text-gray-900 font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label
                          htmlFor={`approve-notes-${item._id}`}
                          className="block text-sm font-medium text-gray-700"
                        >
                          Notes (optional)
                        </label>
                        <textarea
                          id={`approve-notes-${item._id}`}
                          rows={2}
                          maxLength={1000}
                          value={approveNotes[item._id] || ''}
                          onChange={(e) =>
                            setApproveNotes((prev) => ({
                              ...prev,
                              [item._id]: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                          placeholder="Anything worth recording about this decision"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              review(
                                item._id,
                                'approve',
                                approveNotes[item._id] || ''
                              )
                            }
                            className="bg-accent-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isBusy ? 'Approving...' : 'Approve and promote'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(item._id);
                              setRejectNotes('');
                            }}
                            className="border border-red-200 text-red-700 py-2.5 px-5 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminTrainerRequestsPage() {
  return (
    <AdminGuard>
      <AdminTrainerRequestsContent />
    </AdminGuard>
  );
}
