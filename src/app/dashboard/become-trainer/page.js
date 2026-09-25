'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import DocumentUploader from '@/components/DocumentUploader';
import StatusBadge from '@/components/StatusBadge';
import { isPdfDocument, documentViewUrl } from '@/lib/documents';

const MAX_DOCUMENTS = 5;

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BecomeTrainerPage() {
  const { user, loading } = useAuth();

  const [qualifications, setQualifications] = useState('');
  const [experience, setExperience] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [documents, setDocuments] = useState([]);

  const [latestRequest, setLatestRequest] = useState(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchRequest = useCallback(async () => {
    try {
      const res = await fetch('/api/trainer-requests');
      const data = await res.json();

      if (data.success) {
        setLatestRequest(data.latestRequest);
      }
    } catch (error) {
      toast.error('Could not load your application status');
    } finally {
      setIsLoadingRequest(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setIsLoadingRequest(false);
      return;
    }
    fetchRequest();
  }, [user, fetchRequest]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!qualifications.trim() || !experience.trim() || !specialties.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (documents.length === 0) {
      toast.error('Please upload at least one document or certificate');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/trainer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualifications,
          experience,
          specialties,
          documents,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setLatestRequest(data.request);
        setShowForm(false);
        setQualifications('');
        setExperience('');
        setSpecialties('');
        setDocuments([]);
      } else {
        toast.error(data.message || 'Could not submit your application');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoadingRequest) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isPending = latestRequest?.status === 'pending';
  const wasRejected = latestRequest?.status === 'rejected';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
      >
        ← Back to dashboard
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Become a Trainer</h1>
        <p className="text-gray-600 mt-1">
          Share your credentials and our team will review your application.
        </p>
      </div>

      {/* Already a trainer */}
      {user.role === 'trainer' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <span className="text-4xl block mb-3" aria-hidden="true">
            🏋️
          </span>
          <h2 className="text-xl font-semibold text-gray-900">
            You are already a trainer
          </h2>
          <p className="text-gray-600 mt-1">
            Your application was approved. Start building your courses.
          </p>
          <Link
            href="/trainer/courses"
            className="inline-block mt-4 bg-primary-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Go to my courses
          </Link>
        </div>
      )}

      {/* Admins have no reason to apply */}
      {user.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900">Not applicable</h2>
          <p className="text-gray-600 mt-1">
            Admin accounts cannot apply to become a trainer. You can review
            applications in the{' '}
            <Link
              href="/admin/trainer-requests"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              admin panel
            </Link>
            .
          </p>
        </div>
      )}

      {user.role === 'customer' && (
        <>
          {/* Existing application status */}
          {latestRequest && !showForm && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Your application
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Submitted {formatDate(latestRequest.createdAt)}
                  </p>
                </div>
                <StatusBadge status={latestRequest.status} />
              </div>

              {isPending && (
                <p className="text-gray-600 mt-4">
                  An admin is reviewing your documents. You will be promoted to
                  trainer automatically once it is approved.
                </p>
              )}

              {wasRejected && (
                <div className="mt-4 space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-800">
                      Reviewer feedback
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {latestRequest.adminNotes || 'No reason was provided.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="bg-primary-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                  >
                    Apply again
                  </button>
                </div>
              )}

              <dl className="grid sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    Qualifications
                  </dt>
                  <dd className="text-gray-900 whitespace-pre-line">
                    {latestRequest.qualifications}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Experience</dt>
                  <dd className="text-gray-900 whitespace-pre-line">
                    {latestRequest.experience}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Specialties</dt>
                  <dd className="text-gray-900">{latestRequest.specialties}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    Documents
                  </dt>
                  <dd className="flex flex-wrap gap-2">
                    {(latestRequest.documents || []).map((doc) => (
                      <a
                        key={doc.publicId}
                        href={documentViewUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
                      >
                        <span aria-hidden="true">
                          {isPdfDocument(doc) ? '📕' : '🖼️'}
                        </span>
                        {doc.name || 'Document'}
                      </a>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Application form */}
          {(!latestRequest || showForm) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="qualifications"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Qualifications
                  </label>
                  <textarea
                    id="qualifications"
                    required
                    rows={4}
                    maxLength={2000}
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="Certifications, courses and licences you hold"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {qualifications.length}/2000
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="experience"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Experience
                  </label>
                  <textarea
                    id="experience"
                    required
                    rows={4}
                    maxLength={2000}
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="Where you have trained clients, for how long, and the results you delivered"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {experience.length}/2000
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="specialties"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Specialties
                  </label>
                  <input
                    id="specialties"
                    type="text"
                    required
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="Strength training, yoga, nutrition"
                  />
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Documents and certificates
                  </span>
                  <p className="text-sm text-gray-500 mb-2">
                    Upload proof of your certifications so an admin can verify
                    them. At least one file is required.
                  </p>
                  <DocumentUploader
                    value={documents}
                    onChange={setDocuments}
                    folder="trainerDocuments"
                    maxFiles={MAX_DOCUMENTS}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit application'}
                  </button>

                  {showForm && (
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="text-gray-600 hover:text-gray-900 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
