import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainerRequest from '@/models/TrainerRequest';
import { authorizeRequest } from '@/lib/auth';

const VALID_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * GET /api/admin/trainer-requests?status=pending
 *
 * Admin only. Lists trainer applications with the applicant populated, plus
 * per-status counts for the review dashboard. Omit `status` (or pass "all")
 * to list everything.
 */
export async function GET(request) {
  try {
    const auth = await authorizeRequest(request, 'admin');

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    await dbConnect();

    const status = request.nextUrl.searchParams.get('status');

    if (status && status !== 'all' && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status filter' },
        { status: 400 }
      );
    }

    const filter = status && status !== 'all' ? { status } : {};

    const [requests, counts] = await Promise.all([
      TrainerRequest.find(filter)
        .populate('user', 'name email avatar createdAt')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      TrainerRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const summary = { pending: 0, approved: 0, rejected: 0 };
    for (const entry of counts) {
      if (entry._id in summary) summary[entry._id] = entry.count;
    }

    return NextResponse.json(
      { success: true, requests, counts: summary },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin list trainer requests error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
