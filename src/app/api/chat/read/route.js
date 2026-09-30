import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';
import { authenticateRequest } from '@/lib/auth';
import { conversationRoom, emitToUsers, resolveChatAccess } from '@/lib/chat';

/**
 * POST /api/chat/read
 * Body: { courseId, withUserId }
 *
 * Marks the inbound half of a conversation as read. GET /api/chat/messages does
 * this too, but that only covers opening a thread. This endpoint exists for the
 * case where the thread is already on screen and a message arrives over the
 * socket, or the tab regains focus, where refetching the whole page of messages
 * just to clear a flag would be wasteful.
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

    const { courseId, withUserId } = body;

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

    const result = await ChatMessage.updateMany(
      {
        course: access.course._id,
        sender: access.partner._id,
        receiver: auth.user._id,
        read: false,
      },
      { $set: { read: true } }
    );

    if (result.modifiedCount > 0) {
      // Reader included so their own navbar badge and other tabs settle too.
      emitToUsers([access.partner._id, auth.user._id], 'messages:read', {
        room: conversationRoom(access.course._id, auth.user._id, access.partner._id),
        courseId: String(access.course._id),
        readerId: String(auth.user._id),
        count: result.modifiedCount,
      });
    }

    return NextResponse.json(
      { success: true, updated: result.modifiedCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('Mark chat read error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
