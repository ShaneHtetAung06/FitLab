import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { authorizeRequest } from '@/lib/auth';

const VALID_ROLES = ['customer', 'trainer', 'admin'];
const VALID_STATUSES = ['active', 'suspended'];
const MAX_LIMIT = 100;

// User input goes into a $regex, so metacharacters have to be neutralised or a
// caller could craft an expensive or unintended pattern.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/admin/users
 *
 * Admin only. Query params:
 *   search - matches name or email, case insensitive
 *   role   - customer | trainer | admin | all
 *   status - active | suspended | all
 *   page   - 1-based, defaults to 1
 *   limit  - defaults to 20, capped at 100
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

    const params = request.nextUrl.searchParams;
    const search = (params.get('search') || '').trim();
    const role = params.get('role');
    const status = params.get('status');

    if (role && role !== 'all' && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Invalid role filter' },
        { status: 400 }
      );
    }

    if (status && status !== 'all' && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status filter' },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get('limit') || '20', 10) || 20)
    );

    const filter = {};

    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status && status !== 'all') {
      // Accounts created before isActive existed have no such field, so
      // "active" has to include documents where it is missing.
      filter.isActive = status === 'suspended' ? false : { $ne: false };
    }

    const [users, total, roleCounts, suspendedCount] = await Promise.all([
      User.find(filter)
        .select('name email role avatar bio phone isActive createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      User.countDocuments({ isActive: false }),
    ]);

    const counts = { customer: 0, trainer: 0, admin: 0, suspended: suspendedCount };
    for (const entry of roleCounts) {
      if (entry._id in counts) counts[entry._id] = entry.count;
    }

    return NextResponse.json(
      {
        success: true,
        // isActive is normalised here because .lean() skips schema defaults.
        users: users.map((item) => ({ ...item, isActive: item.isActive !== false })),
        counts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin list users error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
