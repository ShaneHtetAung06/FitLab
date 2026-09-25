import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.error) {

      const isSuspended = auth.status === 403;

      const response = NextResponse.json(
        { success: false, message: auth.error, suspended: isSuspended },
        { status: auth.status }
      );

      if (isSuspended) {
        response.cookies.set('token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 0,
          path: '/',
        });
      }

      return response;
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          _id: auth.user._id,
          name: auth.user.name,
          email: auth.user.email,
          role: auth.user.role,
          avatar: auth.user.avatar,
          bio: auth.user.bio,
      
          phone: auth.user.phone,
          createdAt: auth.user.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
