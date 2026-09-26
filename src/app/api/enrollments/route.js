import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Enrollment from '@/models/Enrollment';
import Course from '@/models/Course';
import { authenticateRequest } from '@/lib/auth';
import { computeProgress } from '@/lib/enrollment';
import { summarizeCurriculum } from '@/lib/courseOptions';

/**
 * GET /api/enrollments
 *
 * The signed-in learner's own enrollments, newest first, each with its progress
 * summary so the dashboard can render progress bars without extra requests.
 */
export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const enrollments = await Enrollment.find({ user: auth.user._id })
      .populate({
        path: 'course',
        select:
          'title description thumbnail price category level sections trainer averageRating totalReviews',
        populate: { path: 'trainer', select: 'name avatar' },
      })
      .sort({ createdAt: -1 })
      .lean();

    const items = enrollments
      // A course deleted from under an enrollment would otherwise crash the page.
      .filter((enrollment) => enrollment.course)
      .map((enrollment) => {
        const { sections, ...course } = enrollment.course;
        const progress = computeProgress({ sections }, enrollment);

        return {
          _id: enrollment._id,
          status: enrollment.status,
          amountPaid: enrollment.amountPaid,
          createdAt: enrollment.createdAt,
          completedAt: enrollment.completedAt,
          lastAccessedAt: enrollment.progress?.lastAccessedAt,
          course: { ...course, ...summarizeCurriculum(sections) },
          progress: {
            completedLessons: progress.completedLessons,
            totalLessons: progress.totalLessons,
            percent: progress.percent,
            isComplete: progress.isComplete,
          },
        };
      });

    const counts = {
      all: items.length,
      inProgress: items.filter(
        (item) => item.status === 'active' && !item.progress.isComplete
      ).length,
      completed: items.filter((item) => item.progress.isComplete).length,
    };

    return NextResponse.json({ success: true, enrollments: items, counts }, { status: 200 });
  } catch (error) {
    console.error('List enrollments error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
