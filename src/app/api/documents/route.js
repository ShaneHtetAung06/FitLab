import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainerRequest from '@/models/TrainerRequest';
import { authenticateRequest } from '@/lib/auth';
import {
  isCloudinaryConfigured,
  buildSignedDownloadUrl,
  buildPdfPageImageUrl,
  UPLOAD_FOLDERS,
} from '@/lib/cloudinary';

/**
 * GET /api/documents?publicId=...&resourceType=image&format=pdf&preview=1
 *
 * Streams a stored document back to the browser.
 *
 * This exists because Cloudinary's free tier blocks CDN delivery of PDFs: the
 * stored secure_url answers 401 "deny or ACL failure" while images on the same
 * account deliver fine. Fetching through the Admin API download endpoint is not
 * subject to that restriction, so we read the asset server-side and relay it.
 *
 * Doing it here also means certificates are no longer sitting behind public,
 * guessable URLs. Access is limited to an admin or the applicant who uploaded
 * the file.
 *
 * With `preview=1` a rasterised first page is returned instead, for thumbnails.
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

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { success: false, message: 'File storage is not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = request.nextUrl;
    const publicId = searchParams.get('publicId');
    const resourceType = searchParams.get('resourceType') || 'image';
    const format = searchParams.get('format') || 'pdf';
    const wantsPreview = searchParams.get('preview') === '1';
    const wantsDownload = searchParams.get('download') === '1';

    if (!publicId) {
      return NextResponse.json(
        { success: false, message: 'publicId is required' },
        { status: 400 }
      );
    }

    // Only ever serve assets from folders we own, so this cannot be turned into
    // a general purpose reader for the whole Cloudinary account.
    const isInManagedFolder = Object.values(UPLOAD_FOLDERS).some((folder) =>
      publicId.startsWith(`${folder}/`)
    );

    if (!isInManagedFolder) {
      return NextResponse.json(
        { success: false, message: 'That asset cannot be accessed' },
        { status: 400 }
      );
    }

    if (!['image', 'raw', 'video'].includes(resourceType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid resourceType' },
        { status: 400 }
      );
    }

    // Submitted trainer certificates are sensitive, so once a document is
    // attached to an application only an admin or its own applicant may read it.
    if (publicId.startsWith(`${UPLOAD_FOLDERS.trainerDocuments}/`)) {
      await dbConnect();

      const owner = await TrainerRequest.findOne(
        { 'documents.publicId': publicId },
        { user: 1 }
      ).lean();

      // An unattached asset is one a user has just uploaded and not submitted
      // yet, and it needs to stay previewable in the upload form. This matches
      // how DELETE /api/upload already treats unattached assets.
      if (owner) {
        const isOwner = String(owner.user) === String(auth.user._id);

        if (!isOwner && auth.user.role !== 'admin') {
          return NextResponse.json(
            { success: false, message: 'Not authorized to view this document' },
            { status: 403 }
          );
        }
      }
    }

    // A rasterised page is a plain image transformation, which Cloudinary will
    // deliver even when the underlying PDF is blocked.
    const upstreamUrl = wantsPreview
      ? buildPdfPageImageUrl(publicId, { page: 1, width: 400 })
      : buildSignedDownloadUrl(publicId, { format, resourceType });

    const upstream = await fetch(upstreamUrl, { cache: 'no-store' });

    if (!upstream.ok || !upstream.body) {
      console.error(
        'Document fetch failed:',
        publicId,
        upstream.status,
        upstream.headers.get('x-cld-error') || ''
      );
      return NextResponse.json(
        { success: false, message: 'Could not load this document' },
        { status: 502 }
      );
    }

    const contentType = wantsPreview
      ? 'image/jpeg'
      : upstream.headers.get('content-type') || 'application/octet-stream';

    const filename = sanitizeFilename(
      searchParams.get('name') || publicId.split('/').pop(),
      wantsPreview ? 'jpg' : format
    );

    const headers = new Headers({
      'Content-Type': contentType,
      // "inline" so a PDF opens in a browser tab instead of downloading, which
      // is what an admin reviewing an application expects.
      'Content-Disposition': `${
        wantsDownload ? 'attachment' : 'inline'
      }; filename="${filename}"`,
      // Private: the response is authorized per user, so shared caches and the
      // CDN must not reuse it for somebody else.
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('Document proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Strips anything that could break out of the Content-Disposition header and
 * makes sure the name carries the right extension.
 */
function sanitizeFilename(name, extension) {
  const base = String(name || 'document')
    // Quotes, backslashes, control characters and newlines would let a crafted
    // filename inject extra header directives.
    .replace(/[^\w\-. ]+/g, '_')
    .replace(/\.[^.]*$/, '')
    .trim()
    .slice(0, 100) || 'document';

  return extension ? `${base}.${extension}` : base;
}
