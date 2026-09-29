import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { authorizeRequest } from '@/lib/auth';

// Admin accounts are provisioned directly in the database, so this endpoint
// deliberately refuses to hand out the admin role.
const ASSIGNABLE_ROLES = ['customer', 'trainer'];

/**
 * PATCH /api/admin/users/[id]
 *
 * Admin only. Body may contain either or both of:
 *   role     - 'customer' | 'trainer'
 *   isActive - boolean, false suspends the account
 *
 * Refuses to touch the acting admin's own account or any other admin.
 */
export async function PATCH(request, { params }) {
  try {
    const auth = await authorizeRequest(request, 'admin');

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid user id' },
        { status: 400 }
      );
    }

    // Guards against an admin locking themselves out or self-demoting.
    if (String(auth.user._id) === String(id)) {
      return NextResponse.json(
        { success: false, message: 'You cannot modify your own account' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const hasRole = Object.prototype.hasOwnProperty.call(body, 'role');
    const hasIsActive = Object.prototype.hasOwnProperty.call(body, 'isActive');

    if (!hasRole && !hasIsActive) {
      return NextResponse.json(
        { success: false, message: 'Provide a role or isActive value to update' },
        { status: 400 }
      );
    }

    if (hasRole && !ASSIGNABLE_ROLES.includes(body.role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (hasIsActive && typeof body.isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'isActive must be true or false' },
        { status: 400 }
      );
    }

    await dbConnect();

    const target = await User.findById(id).select('-password');

    if (!target) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Other admins are managed at the database level, not through the panel.
    if (target.role === 'admin') {
      return NextResponse.json(
        { success: false, message: 'Admin accounts cannot be modified here' },
        { status: 403 }
      );
    }

    const updates = {};
    const changes = [];

    if (hasRole && body.role !== target.role) {
      updates.role = body.role;
      changes.push(`role changed to ${body.role}`);
    }

    if (hasIsActive && body.isActive !== (target.isActive !== false)) {
      updates.isActive = body.isActive;
      changes.push(body.isActive ? 'account reactivated' : 'account suspended');
    }

    if (changes.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nothing to update' },
        { status: 400 }
      );
    }

    // findByIdAndUpdate rather than save() so the User pre-save bcrypt hook
    // never runs against a document loaded without its password field.
    const updated = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .select('name email role avatar bio phone isActive createdAt')
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: `${target.name}: ${changes.join(' and ')}`,
        user: { ...updated, isActive: updated.isActive !== false },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
