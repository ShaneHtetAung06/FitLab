/**
 * Server-side helpers shared by the enrollment, progress and review routes.
 */

import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import Review from '@/models/Review';

/** Flattens a course's sections into an ordered list of lesson ids. */
export function collectLessonIds(course) {
  const ids = [];

  for (const section of course?.sections || []) {
    for (const lesson of section?.lessons || []) {
      if (lesson?._id) ids.push(String(lesson._id));
    }
  }

  return ids;
}

/**
 * Works out how far through a course a learner is.
 *
 * Completed lessons that no longer exist (the trainer deleted them) are ignored
 * rather than counted, so progress can never exceed 100%.
 */
export function computeProgress(course, enrollment) {
  const lessonIds = collectLessonIds(course);
  const totalLessons = lessonIds.length;

  const completedSet = new Set(
    (enrollment?.progress?.completedLessons || []).map((entry) =>
      String(entry.lesson)
    )
  );

  const completedIds = lessonIds.filter((id) => completedSet.has(id));
  const completedLessons = completedIds.length;

  return {
    totalLessons,
    completedLessons,
    completedLessonIds: completedIds,
    percent:
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    isComplete: totalLessons > 0 && completedLessons === totalLessons,
  };
}

/**
 * Recalculates a course's cached rating fields from its reviews.
 *
 * Called after any review is written so the catalogue and course cards stay
 * accurate without recomputing an average on every read.
 */
export async function recalculateCourseRating(courseId) {
  const [summary] = await Review.aggregate([
    { $match: { course: courseId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const averageRating = summary?.averageRating
    ? Math.round(summary.averageRating * 100) / 100
    : 0;
  const totalReviews = summary?.totalReviews || 0;

  await Course.findByIdAndUpdate(courseId, { averageRating, totalReviews });

  return { averageRating, totalReviews };
}

/**
 * Recalculates a course's cached enrollment count.
 *
 * Refunded enrollments are excluded so the number shown to buyers reflects
 * people who actually hold access.
 */
export async function recalculateCourseEnrollments(courseId) {
  const totalEnrollments = await Enrollment.countDocuments({
    course: courseId,
    status: { $in: ['active', 'completed'] },
  });

  await Course.findByIdAndUpdate(courseId, { totalEnrollments });

  return totalEnrollments;
}

/**
 * Creates an enrollment, or returns the existing one.
 *
 * Idempotent by design: both the Stripe webhook and the browser returning from
 * Checkout call this for the same payment, and whichever arrives second must not
 * create a duplicate or throw.
 *
 * @returns {{ enrollment: object, created: boolean }}
 */
export async function createEnrollment({
  userId,
  courseId,
  paymentId,
  amountPaid,
  stripeSessionId = null,
}) {
  const existing = await Enrollment.findOne({ user: userId, course: courseId });

  if (existing) {
    // Backfill the session id if the free/direct path created it first.
    if (stripeSessionId && !existing.stripeSessionId) {
      existing.stripeSessionId = stripeSessionId;
      await existing.save();
    }
    return { enrollment: existing, created: false };
  }

  try {
    const enrollment = await Enrollment.create({
      user: userId,
      course: courseId,
      paymentId,
      amountPaid,
      ...(stripeSessionId ? { stripeSessionId } : {}),
      status: 'active',
      progress: { completedLessons: [], lastAccessedAt: new Date() },
    });

    await recalculateCourseEnrollments(courseId);

    return { enrollment, created: true };
  } catch (error) {
    // A concurrent caller won the race against one of the unique indexes.
    if (error?.code === 11000) {
      const enrollment = await Enrollment.findOne({
        user: userId,
        course: courseId,
      });
      if (enrollment) return { enrollment, created: false };
    }
    throw error;
  }
}
