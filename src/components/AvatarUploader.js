'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Images only: avatars render through next/image, so a PDF would break every
// surface the user appears on.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Round avatar picker.
 *
 * Uploads to Cloudinary through /api/upload and hands back { url, publicId } for
 * the profile form to submit. The upload happens immediately so the preview is
 * real, but nothing is attached to the account until the form is saved; the
 * server removes the replaced asset at that point.
 *
 * @param {string}   currentUrl  avatar already on the account
 * @param {object}   pending     freshly uploaded { url, publicId }, if any
 * @param {boolean}  cleared     true when the user chose to remove their avatar
 * @param {Function} onUploaded  receives { url, publicId }
 * @param {Function} onCleared   called when the avatar should be removed
 * @param {string}   name        used for the initial fallback
 */
export default function AvatarUploader({
  currentUrl = '',
  pending = null,
  cleared = false,
  onUploaded,
  onCleared,
  name = '',
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);

  const shownUrl = pending?.url || (cleared ? '' : currentUrl);
  const isBusy = disabled || isUploading;

  const upload = async (fileList) => {
    const file = Array.from(fileList || [])[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Your avatar must be a JPG, PNG or WEBP image');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('That image is larger than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('folder', 'avatars');

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success && data.file) {
        onUploaded({ url: data.file.url, publicId: data.file.publicId });
        toast.success('Picture ready. Save to apply it.');
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      // Cleared so choosing the same file twice still fires a change event.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-5">
      <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-full border border-ink-100 bg-primary-50">
        {shownUrl ? (
          <Image
            src={shownUrl}
            alt=""
            fill
            className="object-cover"
            sizes="80px"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-primary-700">
            {name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}

        {isUploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="spinner h-6 w-6" />
          </span>
        )}
      </span>

      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={isBusy}
          onChange={(event) => upload(event.target.files)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="btn btn-outline btn-sm"
          >
            {isUploading ? 'Uploading…' : shownUrl ? 'Change picture' : 'Upload picture'}
          </button>

          {shownUrl && (
            <button
              type="button"
              onClick={onCleared}
              disabled={isBusy}
              className="text-[13px] font-medium text-ink-400 transition-colors hover:text-primary-600 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>

        <p className="mt-2 text-[12px] text-ink-400">
          JPG, PNG or WEBP up to 5MB. A square image works best.
        </p>
      </div>
    </div>
  );
}
