import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { authenticateRequest, generateToken } from '@/lib/auth';

const MIN_LENGTH = 6;

export async function PATCH(request) {
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

    const currentPassword =
      typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'Both your current and new password are required',
        },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `Your new password must be at least ${MIN_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'Your new password must be different from your current one',
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findById(auth.user._id).select('+password');

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const matches = await user.comparePassword(currentPassword);

    if (!matches) {
  
      return NextResponse.json(
        { success: false, message: 'Your current password is incorrect' },
        { status: 401 }
      );
    }

   
    user.password = newPassword;

    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();

    const response = NextResponse.json(
      {
        success: true,
        message: 'Password changed. Other devices have been signed out.',
      },
      { status: 200 }
    );

    response.cookies.set('token', generateToken(user._id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid password';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
