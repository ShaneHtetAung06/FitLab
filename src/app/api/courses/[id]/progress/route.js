import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import { authenticateRequest } from '@/lib/auth';
import { computeProgress, collectLessonIds } from '@/lib/enrollment';

/**
 * POST /api/courses/[id]/progress
 *
 * Body: { lessonId, completed }
 *
 * Marks one lesson complete or incomplete for the signed-in learner and returns
 * the recalculated progress. When every lesson is done the enrollment flips to
 * 'completed'; unticking a lesson reverts it to 'active'.
 */
export async function POST(request, { params }) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid course id' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Expected a JSON body' },
        { status: 400 }
      );
    }

    const lessonId = typeof body.lessonId === 'string' ? body.lessonId : '';
    const completed = Boolean(body.completed);

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return NextResponse.json(
        { success: false, message: 'A valid lessonId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findById(id).select('sections').lean();

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Course not found' },
        { status: 404 }
      );
    }

    // Progress may only be recorded against a lesson that belongs to this
    // course, so an arbitrary id cannot be written into the array.
    if (!collectLessonIds(course).includes(String(lessonId))) {
      return NextResponse.json(
        { success: false, message: 'That lesson is not part of this course' },
        { status: 400 }
      );
    }

    const enrollment = await Enrollment.findOne({
      user: auth.user._id,
      course: id,
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, message: 'You are not enrolled in this course' },
        { status: 403 }
      );
    }

    if (enrollment.status === 'refunded') {
      return NextResponse.json(
        { success: false, message: 'Your access to this course has ended' },
        { status: 403 }
      );
    }

    const entries = enrollment.progress.completedLessons || [];
    const alreadyDone = entries.some((entry) => String(entry.lesson) === lessonId);

    if (completed && !alreadyDone) {
      entries.push({ lesson: lessonId, completedAt: new Date() });
    } else if (!completed && alreadyDone) {
      enrollment.progress.completedLessons = entries.filter(
        (entry) => String(entry.lesson) !== lessonId
      );
    }

    enrollment.progress.lastAccessedAt = new Date();

    const progress = computeProgress(course, enrollment);

    if (progress.isComplete) {
      enrollment.status = 'completed';
      if (!enrollment.completedAt) enrollment.completedAt = new Date();
    } else if (enrollment.status === 'completed') {
      // Unticking a lesson means the course is no longer finished.
      enrollment.status = 'active';
      enrollment.completedAt = undefined;
    }

    await enrollment.save();

    return NextResponse.json(
      {
        success: true,
        message: completed ? 'Lesson marked complete' : 'Lesson marked incomplete',
        progress: {
          completedLessons: progress.completedLessons,
          totalLessons: progress.totalLessons,
          completedLessonIds: progress.completedLessonIds,
          percent: progress.percent,
          isComplete: progress.isComplete,
        },
        status: enrollment.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update progress error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
