import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import { authenticateRequest } from '@/lib/auth';
import { ACTIVE_ENROLLMENT_STATUSES } from '@/lib/chat';

/**
 * GET /api/chat/conversations
 *
 * Every conversation the signed-in user is entitled to, whether or not anything
 * has been said yet. Listing only existing threads would leave nobody able to
 * send a first message, so the list is built from enrollments and then enriched
 * with message data.
 *
 * A user can appear on both sides of the platform -- a trainer may also be
 * enrolled in someone else's course -- so both directions are collected and
 * merged rather than branching on user.role.
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

    const meId = String(auth.user._id);
    const statusFilter = { $in: ACTIVE_ENROLLMENT_STATUSES };

    const myCourses = await Course.find({ trainer: auth.user._id })
      .select('_id title thumbnail')
      .lean();

    const [asLearner, asTrainer] = await Promise.all([
      // Courses the user bought -> talk to each course's trainer.
      Enrollment.find({ user: auth.user._id, status: statusFilter })
        .populate({
          path: 'course',
          select: 'title thumbnail trainer',
          populate: { path: 'trainer', select: 'name avatar role' },
        })
        .lean(),
      // Courses the user teaches -> talk to each enrolled learner.
      myCourses.length > 0
        ? Enrollment.find({
            course: { $in: myCourses.map((course) => course._id) },
            status: statusFilter,
          })
            .populate('user', 'name avatar role')
            .lean()
        : Promise.resolve([]),
    ]);

    const coursesById = new Map(myCourses.map((course) => [String(course._id), course]));
    const candidates = [];

    for (const enrollment of asLearner) {
      const course = enrollment.course;
      // A course (or its trainer) deleted from under an enrollment would
      // otherwise put a broken row in the list.
      if (!course?.trainer?._id) continue;
      if (String(course.trainer._id) === meId) continue;

      candidates.push({
        course: {
          _id: String(course._id),
          title: course.title,
          thumbnail: course.thumbnail || '',
        },
        partner: {
          _id: String(course.trainer._id),
          name: course.trainer.name,
          avatar: course.trainer.avatar || '',
          role: course.trainer.role,
        },
        viewerRole: 'customer',
      });
    }

    for (const enrollment of asTrainer) {
      const course = coursesById.get(String(enrollment.course));
      if (!course || !enrollment.user?._id) continue;
      if (String(enrollment.user._id) === meId) continue;

      candidates.push({
        course: {
          _id: String(course._id),
          title: course.title,
          thumbnail: course.thumbnail || '',
        },
        partner: {
          _id: String(enrollment.user._id),
          name: enrollment.user.name,
          avatar: enrollment.user.avatar || '',
          role: enrollment.user.role,
        },
        viewerRole: 'trainer',
      });
    }

    // One pass over this user's messages, grouped into (course, partner) threads,
    // giving the preview line and the unread tally per thread.
    const meObjectId = new mongoose.Types.ObjectId(meId);

    const threads = await ChatMessage.aggregate([
      { $match: { $or: [{ sender: meObjectId }, { receiver: meObjectId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            course: '$course',
            partner: {
              $cond: [{ $eq: ['$sender', meObjectId] }, '$receiver', '$sender'],
            },
          },
          lastMessage: {
            $first: {
              message: '$message',
              createdAt: '$createdAt',
              sender: '$sender',
              read: '$read',
            },
          },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', meObjectId] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const threadsByKey = new Map(
      threads.map((thread) => [
        `${String(thread._id.course)}:${String(thread._id.partner)}`,
        thread,
      ])
    );

    // Deduplicated because the same pair can surface twice if a trainer is also
    // enrolled in a course they teach alongside another arrangement.
    const seen = new Set();
    const conversations = [];

    for (const candidate of candidates) {
      const key = `${candidate.course._id}:${candidate.partner._id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const thread = threadsByKey.get(key);

      conversations.push({
        id: key,
        ...candidate,
        lastMessage: thread
          ? {
              message: thread.lastMessage.message,
              createdAt: thread.lastMessage.createdAt,
              sender: String(thread.lastMessage.sender),
              read: Boolean(thread.lastMessage.read),
              mine: String(thread.lastMessage.sender) === meId,
            }
          : null,
        unreadCount: thread?.unreadCount || 0,
      });
    }

    // Active threads first, newest activity at the top; never-used conversations
    // fall to the bottom in alphabetical order so the list is stable.
    conversations.sort((a, b) => {
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
      }
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.partner.name.localeCompare(b.partner.name);
    });

    const totalUnread = conversations.reduce(
      (sum, conversation) => sum + conversation.unreadCount,
      0
    );

    return NextResponse.json({ success: true, conversations, totalUnread }, { status: 200 });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
