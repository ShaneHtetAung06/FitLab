import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { authenticateRequest } from '@/lib/auth';
import {
  UPLOAD_FOLDERS,
  deleteFromCloudinary,
  validateDocumentReference,
} from '@/lib/cloudinary';

const LIMITS = { name: 50, bio: 500, phone: 30 };


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

    const updates = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';

      if (!name) {
        return NextResponse.json(
          { success: false, message: 'Please provide your name' },
          { status: 400 }
        );
      }

      if (name.length > LIMITS.name) {
        return NextResponse.json(
          {
            success: false,
            message: `Name cannot be more than ${LIMITS.name} characters`,
          },
          { status: 400 }
        );
      }

      updates.name = name;
    }


    if (body.bio !== undefined) {
      const bio = typeof body.bio === 'string' ? body.bio.trim() : '';

      if (bio.length > LIMITS.bio) {
        return NextResponse.json(
          {
            success: false,
            message: `Bio cannot be more than ${LIMITS.bio} characters`,
          },
          { status: 400 }
        );
      }

      updates.bio = bio;
    }


    if (body.phone !== undefined) {
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

      if (phone.length > LIMITS.phone) {
        return NextResponse.json(
          {
            success: false,
            message: `Phone number cannot be more than ${LIMITS.phone} characters`,
          },
          { status: 400 }
        );
      }

      if (phone && !/^[\d\s+()./-]+$/.test(phone)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Phone number can only contain digits, spaces and + ( ) - . /',
          },
          { status: 400 }
        );
      }

      updates.phone = phone;
    }

    await dbConnect();

    const user = await User.findById(auth.user._id);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    let assetToDelete = null;

    if (body.avatar !== undefined) {
      if (body.avatar === null) {
        assetToDelete = user.avatarPublicId || null;
        updates.avatar = '';
        updates.avatarPublicId = '';
      } else {

        const validation = validateDocumentReference(body.avatar, UPLOAD_FOLDERS.avatars);

        if (validation.error) {
          return NextResponse.json(
            { success: false, message: validation.error },
            { status: 400 }
          );
        }

        if (body.avatar.publicId !== user.avatarPublicId) {
          assetToDelete = user.avatarPublicId || null;
        }

        updates.avatar = body.avatar.url;
        updates.avatarPublicId = body.avatar.publicId;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No changes were provided' },
        { status: 400 }
      );
    }

    Object.assign(user, updates);
    await user.save();

    if (assetToDelete) {
      await deleteFromCloudinary(assetToDelete, 'image');
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          phone: user.phone,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid profile data';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error('Update profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
