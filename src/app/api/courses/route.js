import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import { authenticateRequest, authorizeRequest } from '@/lib/auth';
import { buildCourseData, validateForPublishing } from '@/lib/courseInput';
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  summarizeCurriculum,
} from '@/lib/courseOptions';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  popular: { totalEnrollments: -1 },
  rating: { averageRating: -1 },
};

/** Escapes user input before it is used inside a regular expression. */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/courses
 *
 * Query: page, limit, search, category, level, sort, status, mine
 *
 * Without `mine=1` this is the public catalogue and only returns published
 * courses. With `mine=1` it returns the signed-in trainer's own courses,
 * including drafts, which is what the trainer dashboard lists.
 */
export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const wantsOwn = searchParams.get('mine') === '1';

    const query = {};
    let currentUser = null;

    if (wantsOwn) {
      const auth = await authorizeRequest(request, 'trainer', 'admin');

      if (auth.error) {
        return NextResponse.json(
          { success: false, message: auth.error },
          { status: auth.status }
        );
      }

      currentUser = auth.user;
      query.trainer = currentUser._id;

      // Drafts are only meaningful to their owner, so the status filter is
      // available here but not on the public catalogue.
      const status = searchParams.get('status');
      if (status === 'published') query.isPublished = true;
      if (status === 'draft') query.isPublished = false;
    } else {
      query.isPublished = true;

      // Allow browsing a single trainer's public catalogue.
      const trainerId = searchParams.get('trainer');
      if (trainerId) {
        if (!mongoose.Types.ObjectId.isValid(trainerId)) {
          return NextResponse.json(
            { success: false, message: 'Invalid trainer id' },
            { status: 400 }
          );
        }
        query.trainer = trainerId;
      }
    }

    const search = (searchParams.get('search') || '').trim();
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ title: pattern }, { description: pattern }];
    }

    const category = searchParams.get('category');
    if (category && category !== 'all') {
      if (!COURSE_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { success: false, message: 'Invalid category' },
          { status: 400 }
        );
      }
      query.category = category;
    }

    const level = searchParams.get('level');
    if (level && level !== 'all') {
      if (!COURSE_LEVELS.includes(level)) {
        return NextResponse.json(
          { success: false, message: 'Invalid level' },
          { status: 400 }
        );
      }
      query.level = level;
    }

    // Captured before the price filter is applied. The catalogue's price slider
    // needs to know the ceiling of the courses that match the *other* filters,
    // otherwise dragging it down would shrink its own maximum.
    const priceScopeQuery = { ...query };

    const maxPriceParam = searchParams.get('maxPrice');
    if (maxPriceParam !== null && maxPriceParam !== '') {
      const ceiling = Number(maxPriceParam);

      if (!Number.isFinite(ceiling) || ceiling < 0) {
        return NextResponse.json(
          { success: false, message: 'Invalid maxPrice' },
          { status: 400 }
        );
      }

      query.price = { $lte: ceiling };
    }

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT)
    );

    const sort = SORTS[searchParams.get('sort')] || SORTS.newest;

    await dbConnect();

    const [courses, total, priceAgg] = await Promise.all([
      Course.find(query)
        .populate('trainer', 'name avatar')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Course.countDocuments(query),
      Course.aggregate([
        { $match: priceScopeQuery },
        { $group: { _id: null, max: { $max: '$price' } } },
      ]),
    ]);

    // Lessons are only needed as totals in a list, and the full text of every
    // lesson would make this response needlessly large.
    const summarized = courses.map(({ sections, ...course }) => ({
      ...course,
      ...summarizeCurriculum(sections),
    }));

    const response = {
      success: true,
      courses: summarized,
      // Rounded up to a whole currency unit so the slider lands on tidy stops.
      priceCeiling: Math.ceil(Number(priceAgg[0]?.max) || 0),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    // The trainer dashboard shows draft/published tab counts.
    if (wantsOwn) {
      const [published, draft] = await Promise.all([
        Course.countDocuments({ trainer: currentUser._id, isPublished: true }),
        Course.countDocuments({ trainer: currentUser._id, isPublished: false }),
      ]);
      response.counts = { published, draft, all: published + draft };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('List courses error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/courses
 *
 * Creates a course owned by the signed-in trainer. Courses start as drafts
 * unless isPublished is sent, and publishing requires a complete course.
 */
export async function POST(request) {
  try {
    const auth = await authorizeRequest(request, 'trainer', 'admin');

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
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

    const result = buildCourseData(body);
    if (result.error) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 400 }
      );
    }

    const { data } = result;

    if (data.isPublished) {
      const check = validateForPublishing(data);
      if (check.error) {
        return NextResponse.json(
          { success: false, message: check.error },
          { status: 400 }
        );
      }
    }

    await dbConnect();

    // Ownership comes from the session, never from the request body.
    const course = await Course.create({ ...data, trainer: auth.user._id });

    return NextResponse.json(
      {
        success: true,
        message: data.isPublished ? 'Course published' : 'Course saved as a draft',
        course,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid course data';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error('Create course error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
