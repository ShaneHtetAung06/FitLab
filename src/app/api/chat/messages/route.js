import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';
import { authenticateRequest } from '@/lib/auth';
import {
  MESSAGE_MAX_LENGTH,
  conversationRoom,
  emitToUsers,
  resolveChatAccess,
  serializeMessage,
  signConversationToken,
} from '@/lib/chat';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 40;

/**
 * Builds the symmetric thread filter. Both directions have to be matched
 * explicitly because sender/receiver are stored as written, not normalised.
 */
function threadFilter(courseId, meId, otherId) {
  return {
    course: courseId,
    $or: [
      { sender: meId, receiver: otherId },
      { sender: otherId, receiver: meId },
    ],
  };
}

/**
 * GET /api/chat/messages?courseId=&withUserId=&before=&limit=
 *
 * One page of a conversation, oldest-first for rendering, newest page first.
 * Opening a thread also clears its unread flags, and tells the other side over
 * the socket so their read receipts update without a refresh.
 *
 * Also returns the signed room token the client needs for typing indicators.
 * Issuing it here is deliberate: this is the point where entitlement has just
 * been verified, so the socket server can trust the token without a DB round
 * trip of its own.
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

    const { searchParams } = request.nextUrl;
    const courseId = searchParams.get('courseId');
    const withUserId = searchParams.get('withUserId');

    if (!courseId || !withUserId) {
      return NextResponse.json(
        { success: false, message: 'courseId and withUserId are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const access = await resolveChatAccess({
      courseId,
      meId: auth.user._id,
      otherId: withUserId,
    });

    if (access.error) {
      return NextResponse.json(
        { success: false, message: access.error },
        { status: access.status }
      );
    }

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT)
    );

    const filter = threadFilter(access.course._id, auth.user._id, withUserId);

    // Cursor for "load older". A timestamp is enough here: two messages in the
    // same millisecond within one two-person thread is not a realistic case, and
    // it keeps the query on the { course, sender, receiver, createdAt } index.
    const before = searchParams.get('before');
    if (before) {
      const cursor = new Date(before);
      if (Number.isNaN(cursor.getTime())) {
        return NextResponse.json(
          { success: false, message: 'Invalid before cursor' },
          { status: 400 }
        );
      }
      filter.createdAt = { $lt: cursor };
    }

    // One extra row is fetched purely to answer "is there more?" without a
    // second count query.
    const page = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = page.length > limit;
    const slice = hasMore ? page.slice(0, limit) : page;

    // Stored newest-first for the cursor, handed over oldest-first for the UI.
    const messages = slice.map(serializeMessage).reverse();

    const readResult = await ChatMessage.updateMany(
      { course: access.course._id, sender: withUserId, receiver: auth.user._id, read: false },
      { $set: { read: true } }
    );

    const room = conversationRoom(access.course._id, auth.user._id, withUserId);

    if (readResult.modifiedCount > 0) {
      // Sent to the reader as well as the partner: the partner needs the read
      // receipt, and the reader's own other tabs need to drop the unread badge.
      emitToUsers([withUserId, auth.user._id], 'messages:read', {
        room,
        courseId: String(access.course._id),
        readerId: String(auth.user._id),
        count: readResult.modifiedCount,
      });
    }

    return NextResponse.json(
      {
        success: true,
        messages,
        course: {
          _id: String(access.course._id),
          title: access.course.title,
          thumbnail: access.course.thumbnail || '',
        },
        partner: {
          _id: String(access.partner._id),
          name: access.partner.name,
          avatar: access.partner.avatar || '',
          role: access.partner.role,
        },
        viewerRole: access.viewerRole,
        room,
        roomToken: signConversationToken({ room, userId: auth.user._id }),
        pagination: {
          limit,
          hasMore,
          // Feed back as ?before= to page further into the history.
          nextCursor: messages.length > 0 ? messages[0].createdAt : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('List chat messages error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/messages
 * Body: { courseId, receiverId, message }
 *
 * Persists a message and then fans it out over the socket. Writing happens here
 * rather than in a socket handler so that the same authorization path guards
 * every message, and so a message is never broadcast that wasn't saved.
 */
export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);

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

    const courseId = body.courseId;
    const receiverId = body.receiverId;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!courseId || !receiverId) {
      return NextResponse.json(
        { success: false, message: 'courseId and receiverId are required' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { success: false, message: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `Message cannot be more than ${MESSAGE_MAX_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const access = await resolveChatAccess({
      courseId,
      meId: auth.user._id,
      otherId: receiverId,
    });

    if (access.error) {
      return NextResponse.json(
        { success: false, message: access.error },
        { status: access.status }
      );
    }

    const created = await ChatMessage.create({
      sender: auth.user._id,
      receiver: access.partner._id,
      course: access.course._id,
      message,
    });

    const payload = serializeMessage(created);
    const room = conversationRoom(access.course._id, auth.user._id, access.partner._id);

    // Sent to both participants: the recipient to receive it, the sender so their
    // other open tabs stay in step. `delivered` tells the caller whether live
    // delivery happened, which is how the client decides to lean on polling.
    const delivered = emitToUsers([auth.user._id, access.partner._id], 'message:new', {
      room,
      message: payload,
      course: {
        _id: String(access.course._id),
        title: access.course.title,
        thumbnail: access.course.thumbnail || '',
      },
      sender: {
        _id: String(auth.user._id),
        name: auth.user.name,
        avatar: auth.user.avatar || '',
        role: auth.user.role,
      },
    });

    return NextResponse.json(
      { success: true, chatMessage: payload, room, delivered },
      { status: 201 }
    );
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid message';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error('Send chat message error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
