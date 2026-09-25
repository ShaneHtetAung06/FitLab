import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainerRequest from '@/models/TrainerRequest';
import { authenticateRequest } from '@/lib/auth';
import {
  validateDocumentReference,
  UPLOAD_FOLDERS,
  MAX_DOCUMENTS,
} from '@/lib/cloudinary';

/**
 * GET /api/trainer-requests
 * Returns the signed-in user's own applications, newest first.
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

    const requests = await TrainerRequest.find({ user: auth.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const pendingRequest = requests.find((item) => item.status === 'pending') || null;

    return NextResponse.json(
      {
        success: true,
        requests,
        // The application the user currently has under review, if any.
        pendingRequest,
        // Latest application of any status, which drives the page state.
        latestRequest: requests[0] || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get trainer requests error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trainer-requests
 * Submits a new trainer application.
 *
 * Body: { qualifications, experience, specialties, documents: [{ url, publicId, ... }] }
 * Documents are uploaded beforehand via POST /api/upload.
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

    const { user } = auth;

    if (user.role === 'trainer') {
      return NextResponse.json(
        { success: false, message: 'You are already a trainer' },
        { status: 400 }
      );
    }

    if (user.role === 'admin') {
      return NextResponse.json(
        { success: false, message: 'Admins cannot apply to become a trainer' },
        { status: 400 }
      );
    }

    await dbConnect();

    const body = await request.json();
    const qualifications = (body.qualifications || '').trim();
    const experience = (body.experience || '').trim();
    const specialties = (body.specialties || '').trim();
    const documents = Array.isArray(body.documents) ? body.documents : [];

    if (!qualifications || !experience || !specialties) {
      return NextResponse.json(
        { success: false, message: 'Please provide all required fields' },
        { status: 400 }
      );
    }

    if (documents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please upload at least one document or certificate',
        },
        { status: 400 }
      );
    }

    if (documents.length > MAX_DOCUMENTS) {
      return NextResponse.json(
        {
          success: false,
          message: `You can attach at most ${MAX_DOCUMENTS} documents`,
        },
        { status: 400 }
      );
    }

    // Only accept references to assets that really live in our Cloudinary folder.
    const sanitizedDocuments = [];
    for (const doc of documents) {
      const validation = validateDocumentReference(doc, UPLOAD_FOLDERS.trainerDocuments);
      if (validation.error) {
        return NextResponse.json(
          { success: false, message: validation.error },
          { status: 400 }
        );
      }

      sanitizedDocuments.push({
        url: doc.url,
        publicId: doc.publicId,
        name: typeof doc.name === 'string' ? doc.name.slice(0, 200) : '',
        format: typeof doc.format === 'string' ? doc.format : '',
        bytes: Number.isFinite(doc.bytes) ? doc.bytes : 0,
        resourceType: typeof doc.resourceType === 'string' ? doc.resourceType : 'image',
      });
    }

    const existingPending = await TrainerRequest.findOne({
      user: user._id,
      status: 'pending',
    });

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          message: 'You already have an application under review',
        },
        { status: 400 }
      );
    }

    const trainerRequest = await TrainerRequest.create({
      user: user._id,
      qualifications,
      experience,
      specialties,
      documents: sanitizedDocuments,
      status: 'pending',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted. An admin will review it shortly.',
        request: trainerRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    // Mongoose validation errors are the user's problem, not a server fault.
    if (error?.name === 'ValidationError') {
      const message =
        Object.values(error.errors || {})[0]?.message || 'Invalid application data';
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    // Partial unique index on { user, status: 'pending' } tripped by a double submit.
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'You already have an application under review' },
        { status: 400 }
      );
    }

    console.error('Create trainer request error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
