'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import StarRating, { StarRatingInput } from '@/components/StarRating';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}


export default function CourseReviews({ courseId, onRatingChange }) {
  const [reviews, setReviews] = useState([]);
  const [viewer, setViewer] = useState({ canReview: false, reason: '', myReview: null });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchReviews = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/courses/${courseId}/reviews?page=${page}`);
        const data = await res.json();

        if (data.success) {
          setReviews(data.reviews);
          setViewer(data.viewer);
          setPagination(data.pagination);

          if (data.viewer?.myReview) {
            setRating(data.viewer.myReview.rating);
            setComment(data.viewer.myReview.comment);
          }
        }
      } catch (error) {
        // A failed review load should not take the whole course page down.
        console.error('Failed to load reviews:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [courseId]
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const submit = async (e) => {
    e.preventDefault();

    if (rating < 1) {
      toast.error('Please choose a star rating');
      return;
    }
    if (!comment.trim()) {
      toast.error('Please write a short comment');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/courses/${courseId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setIsEditing(false);
        onRatingChange?.({
          averageRating: data.averageRating,
          totalReviews: data.totalReviews,
        });
        await fetchReviews(1);
      } else {
        toast.error(data.message || 'Could not save your review');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeReview = async () => {
    if (!window.confirm('Delete your review?')) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/courses/${courseId}/reviews`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setRating(0);
        setComment('');
        setIsEditing(false);
        onRatingChange?.({
          averageRating: data.averageRating,
          totalReviews: data.totalReviews,
        });
        await fetchReviews(1);
      } else {
        toast.error(data.message || 'Could not delete your review');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myReview = viewer.myReview;
  const showsForm = viewer.canReview && (!myReview || isEditing);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Reviews{pagination.total > 0 ? ` (${pagination.total})` : ''}
      </h2>

      {/* Own review / form */}
      {showsForm ? (
        <form onSubmit={submit} className="mb-6 pb-6 border-b border-gray-100 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {myReview ? 'Update your review' : 'Share your experience'}
          </p>

          <StarRatingInput
            value={rating}
            onChange={setRating}
            disabled={isSubmitting}
          />

          <div>
            <label htmlFor="review-comment" className="sr-only">
              Your review
            </label>
            <textarea
              id="review-comment"
              rows={4}
              value={comment}
              maxLength={1000}
              disabled={isSubmitting}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you get out of this course? Was the coaching clear?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">{comment.length}/1000</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-600 text-white py-2.5 px-5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : myReview ? 'Update review' : 'Post review'}
            </button>
            {myReview && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setRating(myReview.rating);
                  setComment(myReview.comment);
                }}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        myReview && (
          <div className="mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-700">Your review</p>
                <div className="mt-1">
                  <StarRating value={myReview.rating} showValue={false} />
                </div>
                <p className="text-gray-700 mt-2 whitespace-pre-line">
                  {myReview.comment}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={removeReview}
                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {!viewer.canReview && viewer.reason && (
        <p className="text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
          {viewer.reason}.
        </p>
      )}

      {/* Everyone else's reviews */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
        </div>
      ) : reviews.filter((review) => review._id !== myReview?._id).length === 0 ? (
        <p className="text-sm text-gray-600">
          {myReview
            ? 'No other reviews yet.'
            : 'No reviews yet. Be the first to share your experience.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {reviews
              .filter((review) => review._id !== myReview?._id)
              .map((review) => (
                <li key={review._id} className="py-4 first:pt-0">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {review.user?.avatar ? (
                        <Image
                          src={review.user.avatar}
                          alt=""
                          width={36}
                          height={36}
                          className="w-9 h-9 object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-primary-600 font-semibold text-sm">
                          {review.user?.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">
                          {review.user?.name || 'A learner'}
                        </p>
                        <StarRating value={review.rating} showValue={false} />
                        <span className="text-xs text-gray-500">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700 mt-1 whitespace-pre-line">
                        {review.comment}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5 pt-5 border-t border-gray-100">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => fetchReviews(pagination.page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReviews(pagination.page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
