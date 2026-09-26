import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainerRequest from '@/models/TrainerRequest';
import { authenticateRequest } from '@/lib/auth';
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  validateUploadFile,
  toStoredFile,
  UPLOAD_FOLDERS,
  MAX_DOCUMENTS,
} from '@/lib/cloudinary';

/**
 * POST /api/upload
 *
 * Multipart form data:
 *   files  - one or more files (also accepts the singular key "file")
 *   folder - optional key of UPLOAD_FOLDERS, defaults to "trainerDocuments"
 *
 * Auth is required so this cannot be used as an open file host, and the folder
 * is resolved through a whitelist so a caller cannot write anywhere they like.
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

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message:
            'File uploads are not configured. Add your Cloudinary credentials to .env.',
        },
        { status: 503 }
      );
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Expected a multipart form upload' },
        { status: 400 }
      );
    }

    const files = [...formData.getAll('files'), ...formData.getAll('file')].filter(
      (entry) => entry && typeof entry !== 'string'
    );

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No files were provided' },
        { status: 400 }
      );
    }

    if (files.length > MAX_DOCUMENTS) {
      return NextResponse.json(
        {
          success: false,
          message: `You can upload at most ${MAX_DOCUMENTS} files at a time`,
        },
        { status: 400 }
      );
    }

    const folderKey = formData.get('folder') || 'trainerDocuments';
    const folder = UPLOAD_FOLDERS[folderKey];

    if (!folder) {
      return NextResponse.json(
        { success: false, message: 'Invalid upload folder' },
        { status: 400 }
      );
    }

    // Validate everything up front so we never upload a partial batch.
    for (const file of files) {
      const validation = validateUploadFile(file);
      if (validation.error) {
        return NextResponse.json(
          { success: false, message: validation.error },
          { status: 400 }
        );
      }
    }

    const uploaded = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadToCloudinary(buffer, {
        folder,
        filename: file.name,
      });
      uploaded.push(toStoredFile(result, file.name));
    }

    return NextResponse.json(
      {
        success: true,
        message: `Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}`,
        files: uploaded,
        // Convenience for single-file callers.
        file: uploaded[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 *
 * Body: { publicId, resourceType? }
 *
 * Cleans up a freshly uploaded asset the user removed before submitting a form.
 * Deletion is limited to our own folders, and refused once the asset is attached
 * to a trainer application so one user cannot delete another user's evidence.
 */
export async function DELETE(request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { publicId, resourceType } = await request.json();

    if (!publicId || typeof publicId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'publicId is required' },
        { status: 400 }
      );
    }

    const isInManagedFolder = Object.values(UPLOAD_FOLDERS).some((folder) =>
      publicId.startsWith(`${folder}/`)
    );

    if (!isInManagedFolder) {
      return NextResponse.json(
        { success: false, message: 'That asset cannot be deleted' },
        { status: 400 }
      );
    }

    await dbConnect();

    const attached = await TrainerRequest.exists({ 'documents.publicId': publicId });

    if (attached) {
      return NextResponse.json(
        {
          success: false,
          message: 'This document is attached to an application and cannot be deleted',
        },
        { status: 409 }
      );
    }

    await deleteFromCloudinary(publicId, resourceType || 'image');

    return NextResponse.json(
      { success: true, message: 'File removed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Upload delete error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to remove file' },
      { status: 500 }
    );
  }
}
