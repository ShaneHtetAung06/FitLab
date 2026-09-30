import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import User from '@/models/User';
import { MESSAGE_MAX_LENGTH } from '@/lib/chatConstants';

/**
 * Shared rules and plumbing for trainer <-> customer chat.
 *
 * Authorization lives here rather than in each route so that "who may talk to
 * whom" is defined exactly once. Both the thread reader and the message sender
 * call resolveChatAccess, which means a customer can never reach a trainer they
 * have not bought from, in either direction.
 */

// Re-exported so API routes have one import for chat concerns, while client
// components can take the limit from lib/chatConstants without importing models.
export { MESSAGE_MAX_LENGTH };

// A refunded enrollment ends the working relationship, so it also ends access to
// the conversation. Existing history is kept, it just can't be extended.
const ACTIVE_ENROLLMENT_STATUSES = ['active', 'completed'];

// Long enough to cover a sitting at the keyboard, short enough that a leaked
// token is not a standing invitation to a room.
const ROOM_TOKEN_TTL = '2h';

/**
 * Stable room name for a conversation. The two user ids are sorted so both
 * participants derive the same string without needing to know who the trainer
 * is.
 */
export function conversationRoom(courseId, userA, userB) {
  const [low, high] = [String(userA), String(userB)].sort();
  return `chat:${String(courseId)}:${low}:${high}`;
}

/**
 * Mints the proof a client presents to `conversation:join`. Only ever called
 * after resolveChatAccess has approved the pair, which is what lets the socket
 * server admit people to rooms without querying MongoDB itself.
 */
export function signConversationToken({ room, userId }) {
  return jwt.sign(
    { purpose: 'chat-room', room, uid: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: ROOM_TOKEN_TTL }
  );
}

/**
 * The Socket.IO server instance, or null when the app is running without the
 * custom server (for example under plain `next start`, or during `next build`).
 * Callers must treat null as "no live delivery this time" rather than an error:
 * the message is already persisted, and the client falls back to polling.
 */
export function getIO() {
  return globalThis.__fitlabIO || null;
}

/**
 * Pushes an event to every socket belonging to the given users. Socket.IO
 * de-duplicates across rooms, so a user listed twice still receives one copy.
 * Returns whether a live server was available.
 */
export function emitToUsers(userIds, event, payload) {
  const io = getIO();
  if (!io) return false;

  const rooms = [...new Set(userIds.filter(Boolean).map(String))].map((id) => `user:${id}`);
  if (rooms.length === 0) return false;

  io.to(rooms).emit(event, payload);
  return true;
}

/**
 * Decides whether `meId` may exchange messages with `otherId` about `courseId`,
 * and gathers the context both chat routes need.
 *
 * Allowed only when one side owns the course and the other holds a live
 * enrollment in it. Admins are intentionally not granted access: this is a
 * private one-to-one channel, and silently including staff would be surprising.
 *
 * @returns {Promise<{course, partner, viewerRole: 'trainer'|'customer'} | {error: string, status: number}>}
 */
export async function resolveChatAccess({ courseId, meId, otherId }) {
  if (!mongoose.Types.ObjectId.isValid(String(courseId || ''))) {
    return { error: 'Invalid course id', status: 400 };
  }

  if (!mongoose.Types.ObjectId.isValid(String(otherId || ''))) {
    return { error: 'Invalid user id', status: 400 };
  }

  const me = String(meId);
  const other = String(otherId);

  if (me === other) {
    return { error: 'You cannot message yourself', status: 400 };
  }

  const course = await Course.findById(courseId)
    .select('_id title thumbnail trainer')
    .lean();

  if (!course) {
    return { error: 'Course not found', status: 404 };
  }

  const trainerId = String(course.trainer);

  // Exactly one of the two participants has to be the course's trainer; the
  // other is then the learner whose enrollment gets checked.
  let learnerId;
  let viewerRole;

  if (trainerId === me) {
    viewerRole = 'trainer';
    learnerId = other;
  } else if (trainerId === other) {
    viewerRole = 'customer';
    learnerId = me;
  } else {
    return {
      error: 'This conversation is not available for this course',
      status: 403,
    };
  }

  const [enrollment, partner] = await Promise.all([
    Enrollment.findOne({ user: learnerId, course: course._id }).select('status').lean(),
    User.findById(other).select('name avatar role').lean(),
  ]);

  if (!enrollment || !ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status)) {
    return {
      error:
        viewerRole === 'trainer'
          ? 'That learner is not enrolled in this course'
          : 'You can only message the trainer of a course you are enrolled in',
      status: 403,
    };
  }

  if (!partner) {
    return { error: 'User not found', status: 404 };
  }

  return { course, partner, viewerRole };
}

/**
 * Trims the stored shape down to what the UI renders, and flattens ids to
 * strings so client-side comparisons against `user._id` are straightforward.
 */
export function serializeMessage(doc) {
  return {
    _id: String(doc._id),
    course: String(doc.course),
    sender: String(doc.sender?._id || doc.sender),
    receiver: String(doc.receiver?._id || doc.receiver),
    message: doc.message,
    read: Boolean(doc.read),
    createdAt: doc.createdAt,
  };
}

export { ACTIVE_ENROLLMENT_STATUSES };
