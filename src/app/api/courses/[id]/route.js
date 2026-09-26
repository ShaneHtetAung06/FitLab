import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import Review from '@/models/Review';
import { authenticateRequest, authorizeRequest } from '@/lib/auth';
import { buildCourseData, validateForPublishing } from '@/lib/courseInput';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { summarizeCurriculum } from '@/lib/courseOptions';
import { computeProgress } from '@/lib/enrollment';

/** Shared guard: valid id, course exists, and the caller owns it. */
async function loadOwnedCourse(request, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: 'Invalid course id', status: 400 };
  }

  const auth = await authorizeRequest(request, 'trainer', 'admin');
  if (auth.error) return auth;

  await dbConnect();

  const course = await Course.findById(id);
  if (!course) {
    return { error: 'Course not found', status: 404 };
  }

  // A trainer may only touch their own courses; an admin may moderate any.
  const isOwner = String(course.trainer) === String(auth.user._id);
  if (!isOwner && auth.user.role !== 'admin') {
    return { error: 'You can only manage your own courses', status: 403 };
  }

  return { course, user: auth.user, isOwner };
}

/**
 * GET /api/courses/[id]
 *
 * Returns a single course with its full curriculum. Drafts are visible only to
 * their owner and to admins. For anyone who is not the owner, lesson bodies are
 * withheld unless the lesson is marked as a free preview or the viewer is
 * enrolled, so the paid content is not readable straight from the API.
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

    await dbConnect();

    const course = await Course.findById(id)
      .populate('trainer', 'name avatar bio')
      .lean();

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Course not found' },
        { status: 404 }
      );
    }

    // Identify the viewer, but stay readable for anonymous visitors.
    const auth = await authenticateRequest(request);
    const viewer = auth.user || null;

    const isOwner =
      viewer && String(course.trainer?._id || course.trainer) === String(viewer._id);
    const isAdmin = viewer?.role === 'admin';

    if (!course.isPublished && !isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Course not found' },
        { status: 404 }
      );
    }

    let isEnrolled = false;
    let enrollment = null;

    if (viewer && !isOwner) {
      enrollment = await Enrollment.findOne({
        user: viewer._id,
        course: course._id,
      }).lean();

      isEnrolled = Boolean(
        enrollment && ['active', 'completed'].includes(enrollment.status)
      );
    }

    const hasFullAccess = Boolean(isOwner || isAdmin || isEnrolled);

    const sections = (course.sections || []).map((section) => ({
      ...section,
      lessons: (section.lessons || []).map((lesson) => {
        if (hasFullAccess || lesson.isPreview) return lesson;

        // Keep the outline visible so learners can see what they would get,
        // but strip the material itself.
        const { content, videoUrl, ...rest } = lesson;
        return { ...rest, isLocked: true };
      }),
    }));

    return NextResponse.json(
      {
        success: true,
        course: {
          ...course,
          sections,
          ...summarizeCurriculum(course.sections),
        },
        access: { isOwner, isAdmin, isEnrolled, hasFullAccess },
        // Lets the player render tick marks and a progress bar from one request.
        progress: isEnrolled ? computeProgress(course, enrollment) : null,
        enrollment: isEnrolled
          ? { _id: enrollment._id, status: enrollment.status }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get course error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/courses/[id]
 *
 * Updates any subset of a course's fields. Only the owning trainer (or an
 * admin) may call it. Replacing the thumbnail cleans up the old Cloudinary
 * asset once the new one is safely saved.
 */
export async function PATCH(request, { params }) {
  try {
    const loaded = await loadOwnedCourse(request, params.id);

    if (loaded.error) {
      return NextResponse.json(
        { success: false, message: loaded.error },
        { status: loaded.status }
      );
    }

    const { course } = loaded;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Expected a JSON body' },
        { status: 400 }
      );
    }

    const result = buildCourseData(body, { partial: true });
    if (result.error) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 400 }
      );
    }

    const { data } = result;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No changes were provided' },
        { status: 400 }
      );
    }

    const previousThumbnailId = course.thumbnailPublicId;
    const isReplacingThumbnail =
      Object.prototype.hasOwnProperty.call(data, 'thumbnailPublicId') &&
      previousThumbnailId &&
      data.thumbnailPublicId !== previousThumbnailId;

    Object.assign(course, data);

    // Validate completeness against the merged course, so publishing an
    // existing draft with a one-field PATCH is still checked properly.
    if (course.isPublished) {
      const check = validateForPublishing(course);
      if (check.error) {
        return NextResponse.json(
          { success: false, message: check.error },
          { status: 400 }
        );
      }
    }

    await course.save();

    // Only after a successful save, so a failed update never orphans the image
    // the course is still pointing at.
    if (isReplacingThumbnail) {
      await deleteFromCloudinary(previousThumbnailId, 'image');
    }

    return NextResponse.json(
      { success: true, message: 'Course updated', course },
      { status: 200 }
    );
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid course data';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error('Update course error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/courses/[id]
 *
 * Deletes a course. Refused once learners have enrolled, because they paid for
 * access and removing it would destroy their purchase; unpublishing is the right
 * move there instead.
 */
export async function DELETE(request, { params }) {
  try {
    const loaded = await loadOwnedCourse(request, params.id);

    if (loaded.error) {
      return NextResponse.json(
        { success: false, message: loaded.error },
        { status: loaded.status }
      );
    }

    const { course } = loaded;

    const enrollmentCount = await Enrollment.countDocuments({ course: course._id });

    if (enrollmentCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `This course has ${enrollmentCount} enrolled learner${
            enrollmentCount === 1 ? '' : 's'
          } and cannot be deleted. Unpublish it instead to hide it from the catalogue.`,
        },
        { status: 409 }
      );
    }

    const thumbnailPublicId = course.thumbnailPublicId;

    await course.deleteOne();

    // Reviews for a course nobody can reach are just orphans.
    await Review.deleteMany({ course: course._id });

    if (thumbnailPublicId) {
      await deleteFromCloudinary(thumbnailPublicId, 'image');
    }

    return NextResponse.json(
      { success: true, message: 'Course deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete course error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
