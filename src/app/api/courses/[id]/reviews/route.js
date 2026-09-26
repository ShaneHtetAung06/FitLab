import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import Review from '@/models/Review';
import Enrollment from '@/models/Enrollment';
import { authenticateRequest } from '@/lib/auth';
import { recalculateCourseRating } from '@/lib/enrollment';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

/**
 * GET /api/courses/[id]/reviews
 *
 * Public, paginated review list for a course, newest first. Also reports whether
 * the signed-in viewer may leave a review and what they have already written.
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid course id' },
        { status: 400 }
      );
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT)
    );

    await dbConnect();

    const [reviews, total] = await Promise.all([
      Review.find({ course: id })
        .populate('user', 'name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ course: id }),
    ]);

    // Viewer context, kept optional so anonymous visitors still get the list.
    const auth = await authenticateRequest(request);
    let viewer = { canReview: false, reason: 'Sign in to review', myReview: null };

    if (auth.user) {
      const [enrollment, myReview] = await Promise.all([
        Enrollment.findOne({ user: auth.user._id, course: id })
          .select('status')
          .lean(),
        Review.findOne({ user: auth.user._id, course: id }).lean(),
      ]);

      if (myReview) {
        viewer = { canReview: true, reason: '', myReview };
      } else if (enrollment && enrollment.status !== 'refunded') {
        viewer = { canReview: true, reason: '', myReview: null };
      } else {
        viewer = {
          canReview: false,
          reason: 'Only enrolled learners can review this course',
          myReview: null,
        };
      }
    }

    return NextResponse.json(
      {
        success: true,
        reviews,
        viewer,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('List reviews error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/courses/[id]/reviews
 *
 * Body: { rating, comment }
 *
 * Creates or replaces the signed-in learner's review. Restricted to people who
 * actually bought the course, so ratings cannot be brigaded by non-buyers, and
 * the course's cached rating is recalculated afterwards.
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

    const rating = Number(body.rating);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: 'Choose a rating between 1 and 5 stars' },
        { status: 400 }
      );
    }

    if (!comment) {
      return NextResponse.json(
        { success: false, message: 'Please write a short comment' },
        { status: 400 }
      );
    }

    if (comment.length > 1000) {
      return NextResponse.json(
        { success: false, message: 'Comment cannot be more than 1000 characters' },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findById(id).select('_id trainer');

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Course not found' },
        { status: 404 }
      );
    }

    // A trainer rating their own course would be meaningless.
    if (String(course.trainer) === String(auth.user._id)) {
      return NextResponse.json(
        { success: false, message: 'You cannot review your own course' },
        { status: 403 }
      );
    }

    const enrollment = await Enrollment.findOne({
      user: auth.user._id,
      course: course._id,
    })
      .select('status')
      .lean();

    if (!enrollment || enrollment.status === 'refunded') {
      return NextResponse.json(
        {
          success: false,
          message: 'Only enrolled learners can review this course',
        },
        { status: 403 }
      );
    }

    const review = await Review.findOneAndUpdate(
      { user: auth.user._id, course: course._id },
      { rating, comment },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).populate('user', 'name avatar');

    const summary = await recalculateCourseRating(course._id);

    return NextResponse.json(
      {
        success: true,
        message: 'Thanks for your review',
        review,
        ...summary,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid review';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error('Create review error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/courses/[id]/reviews
 *
 * Removes the signed-in learner's own review.
 */
export async function DELETE(request, { params }) {
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

    await dbConnect();

    const deleted = await Review.findOneAndDelete({
      user: auth.user._id,
      course: id,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'You have not reviewed this course' },
        { status: 404 }
      );
    }

    const summary = await recalculateCourseRating(new mongoose.Types.ObjectId(id));

    return NextResponse.json(
      { success: true, message: 'Review removed', ...summary },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
