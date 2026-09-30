import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';
import { authenticateRequest } from '@/lib/auth';

/**
 * GET /api/chat/unread
 *
 * Total inbound unread count for the navbar badge. Kept separate from
 * /api/chat/conversations because the badge is rendered on every page, and this
 * is a single counted index scan rather than the full thread aggregation.
 *
 * Known limitation: this counts every unread message, whereas the conversation
 * list hides threads whose enrollment was refunded. Someone refunded while
 * holding unread messages would see a badge with no matching thread. Rare enough
 * to leave alone rather than pay the cost of the full entitlement check here.
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

    const totalUnread = await ChatMessage.countDocuments({
      receiver: auth.user._id,
      read: false,
    });

    return NextResponse.json({ success: true, totalUnread }, { status: 200 });
  } catch (error) {
    console.error('Chat unread count error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
