import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import Review from '@/models/Review';
import { authorizeRequest } from '@/lib/auth';
import { summarizeCurriculum } from '@/lib/courseOptions';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

/**
 * GET /api/trainer/analytics?days=30
 *
 * Performance summary for the signed-in trainer's own courses: revenue,
 * enrolments, ratings, a daily time series for the chart, and a per-course
 * breakdown.
 *
 * Revenue is derived from Enrollment.amountPaid rather than course price, so
 * historical sales stay correct after a trainer changes their pricing. Refunded
 * enrolments are excluded from revenue but reported separately.
 */
export async function GET(request) {
  try {
    const auth = await authorizeRequest(request, 'trainer', 'admin');

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const days = Math.min(
      MAX_DAYS,
      Math.max(1, Number(request.nextUrl.searchParams.get('days')) || DEFAULT_DAYS)
    );

    await dbConnect();

    const trainerId = new mongoose.Types.ObjectId(String(auth.user._id));

    // Day boundaries are computed in UTC because $dateToString below buckets in
    // UTC. Mixing the two shifts the keys by a day for any server not on UTC,
    // which silently drops the newest sales out of the chart.
    const now = new Date();
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const courses = await Course.find({ trainer: trainerId })
      .select(
        'title thumbnail price isPublished category level totalEnrollments averageRating totalReviews sections createdAt publishedAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    const courseIds = courses.map((course) => course._id);

    // Nothing sold yet, so skip the aggregations entirely.
    if (courseIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          range: { days, since },
          totals: emptyTotals(),
          timeseries: buildEmptySeries(since, days),
          courses: [],
          recentEnrollments: [],
          topCourses: [],
          ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
        { status: 200 }
      );
    }

    const paidMatch = {
      course: { $in: courseIds },
      status: { $in: ['active', 'completed'] },
    };

    const [
      overall,
      refunded,
      perCourse,
      series,
      recentEnrollments,
      ratingBuckets,
      inRange,
    ] = await Promise.all([
      // Lifetime revenue and enrolment count.
      Enrollment.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$amountPaid' },
            enrollments: { $sum: 1 },
            learners: { $addToSet: '$user' },
          },
        },
      ]),

      Enrollment.aggregate([
        { $match: { course: { $in: courseIds }, status: 'refunded' } },
        {
          $group: {
            _id: null,
            amount: { $sum: '$amountPaid' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Revenue and enrolments grouped by course.
      Enrollment.aggregate([
        { $match: { course: { $in: courseIds } } },
        {
          $group: {
            _id: '$course',
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'refunded'] }, 0, '$amountPaid'],
              },
            },
            enrollments: {
              $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 0, 1] },
            },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            refunds: {
              $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] },
            },
          },
        },
      ]),

      // Daily series for the selected window.
      Enrollment.aggregate([
        { $match: { ...paidMatch, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            revenue: { $sum: '$amountPaid' },
            enrollments: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Enrollment.find(paidMatch)
        .select('user course amountPaid status createdAt')
        .populate('user', 'name avatar')
        .populate('course', 'title')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),

      Review.aggregate([
        { $match: { course: { $in: courseIds } } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),

      // Same window, to show movement against the lifetime figures.
      Enrollment.aggregate([
        { $match: { ...paidMatch, createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$amountPaid' },
            enrollments: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statsByCourse = new Map(
      perCourse.map((row) => [String(row._id), row])
    );

    const courseRows = courses.map((course) => {
      const stats = statsByCourse.get(String(course._id));
      const { sections, ...rest } = course;

      return {
        ...rest,
        ...summarizeCurriculum(sections),
        revenue: stats?.revenue || 0,
        enrollments: stats?.enrollments || 0,
        completed: stats?.completed || 0,
        refunds: stats?.refunds || 0,
      };
    });

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    let ratingCount = 0;
    for (const bucket of ratingBuckets) {
      ratingBreakdown[bucket._id] = bucket.count;
      ratingSum += bucket._id * bucket.count;
      ratingCount += bucket.count;
    }

    const lifetime = overall[0] || {};
    const window = inRange[0] || {};

    const totals = {
      revenue: round2(lifetime.revenue || 0),
      enrollments: lifetime.enrollments || 0,
      uniqueLearners: (lifetime.learners || []).length,
      publishedCourses: courses.filter((course) => course.isPublished).length,
      draftCourses: courses.filter((course) => !course.isPublished).length,
      totalCourses: courses.length,
      averageRating: ratingCount ? round2(ratingSum / ratingCount) : 0,
      totalReviews: ratingCount,
      refundedAmount: round2(refunded[0]?.amount || 0),
      refundedCount: refunded[0]?.count || 0,
      rangeRevenue: round2(window.revenue || 0),
      rangeEnrollments: window.enrollments || 0,
    };

    return NextResponse.json(
      {
        success: true,
        range: { days, since },
        totals,
        timeseries: fillSeries(series, since, days),
        courses: courseRows,
        topCourses: [...courseRows]
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        recentEnrollments,
        ratingBreakdown,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Trainer analytics error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toKey(date) {
  return date.toISOString().slice(0, 10);
}

function emptyTotals() {
  return {
    revenue: 0,
    enrollments: 0,
    uniqueLearners: 0,
    publishedCourses: 0,
    draftCourses: 0,
    totalCourses: 0,
    averageRating: 0,
    totalReviews: 0,
    refundedAmount: 0,
    refundedCount: 0,
    rangeRevenue: 0,
    rangeEnrollments: 0,
  };
}

function buildEmptySeries(since, days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(since);
    // UTC arithmetic to match the UTC keys produced by $dateToString.
    date.setUTCDate(date.getUTCDate() + index);
    return { date: toKey(date), revenue: 0, enrollments: 0 };
  });
}

/**
 * Turns sparse aggregation output into one entry per day so the chart has no
 * gaps and the x-axis stays evenly spaced.
 */
function fillSeries(rows, since, days) {
  const byDate = new Map(rows.map((row) => [row._id, row]));

  return buildEmptySeries(since, days).map((day) => {
    const row = byDate.get(day.date);
    return {
      date: day.date,
      revenue: round2(row?.revenue || 0),
      enrollments: row?.enrollments || 0,
    };
  });
}
