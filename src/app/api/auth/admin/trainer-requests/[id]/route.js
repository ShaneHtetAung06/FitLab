import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TrainerRequest from '@/models/TrainerRequest';
import User from '@/models/User';
import { authorizeRequest } from '@/lib/auth';

/**
 * GET /api/admin/trainer-requests/[id]
 * Admin only. Full detail for a single application.
 */
export async function GET(request, { params }) {
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
        { success: false, message: 'Invalid request id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const trainerRequest = await TrainerRequest.findById(id)
      .populate('user', 'name email avatar bio phone createdAt role')
      .populate('reviewedBy', 'name email')
      .lean();

    if (!trainerRequest) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, request: trainerRequest },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin get trainer request error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/trainer-requests/[id]
 *
 * Body: { action: 'approve' | 'reject', adminNotes?: string }
 *
 * Admin only. Approving promotes the applicant to the trainer role. Only
 * pending applications can be reviewed, so a decision cannot be flipped later.
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
        { success: false, message: 'Invalid request id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body.action;
    const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.trim() : '';

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Action must be either 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // A rejected applicant should always learn why.
    if (action === 'reject' && !adminNotes) {
      return NextResponse.json(
        { success: false, message: 'Please provide a reason for rejecting' },
        { status: 400 }
      );
    }

    if (adminNotes.length > 1000) {
      return NextResponse.json(
        { success: false, message: 'Notes cannot be more than 1000 characters' },
        { status: 400 }
      );
    }

    await dbConnect();

    const trainerRequest = await TrainerRequest.findById(id);

    if (!trainerRequest) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    if (trainerRequest.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          message: `This application was already ${trainerRequest.status}`,
        },
        { status: 409 }
      );
    }

    const applicant = await User.findById(trainerRequest.user).select('-password');

    if (!applicant) {
      return NextResponse.json(
        { success: false, message: 'The applicant no longer exists' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      if (applicant.role === 'admin') {
        return NextResponse.json(
          { success: false, message: 'Cannot change the role of an admin' },
          { status: 400 }
        );
      }

      // findByIdAndUpdate rather than save() so the User pre-save bcrypt hook
      // never runs against a document loaded without its password field.
      await User.findByIdAndUpdate(applicant._id, { role: 'trainer' });
    }

    trainerRequest.status = action === 'approve' ? 'approved' : 'rejected';
    trainerRequest.adminNotes = adminNotes;
    trainerRequest.reviewedBy = auth.user._id;
    trainerRequest.reviewedAt = new Date();
    await trainerRequest.save();

    const updated = await TrainerRequest.findById(id)
      .populate('user', 'name email avatar role')
      .populate('reviewedBy', 'name email')
      .lean();

    return NextResponse.json(
      {
        success: true,
        message:
          action === 'approve'
            ? `${applicant.name} is now a trainer`
            : 'Application rejected',
        request: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin review trainer request error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
