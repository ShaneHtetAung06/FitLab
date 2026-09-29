'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { formatBytes } from '@/lib/documents';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Images only: a course card renders this through next/image, so a PDF here
// would break every listing the course appears in.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Single-image uploader for a course thumbnail.
 *
 * Uploads straight to Cloudinary through /api/upload and hands the stored file
 * reference back so the course payload can carry { url, publicId, format }.
 *
 * @param {object|null} value     current thumbnail reference
 * @param {Function}    onChange  receives the next reference, or null when cleared
 * @param {boolean}     disabled
 */
export default function ThumbnailUploader({ value = null, onChange, disabled = false }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const upload = async (fileList) => {
    const file = Array.from(fileList || [])[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('The thumbnail must be a JPG, PNG or WEBP image');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" is larger than 5MB`);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('folder', 'courseThumbnails');

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success && data.file) {
        // Replacing an existing image: the old Cloudinary asset is cleaned up
        // server-side when the course is saved, so nothing to do here.
        onChange(data.file);
        toast.success('Thumbnail uploaded');
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = () => {
    onChange(null);
  };

  const isBusy = disabled || isUploading;

  if (value?.url) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-64 aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
          <Image
            src={value.url}
            alt="Course thumbnail preview"
            fill
            className="object-cover"
            sizes="256px"
            unoptimized
          />
        </div>

        <div className="flex flex-col justify-center gap-2 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {value.name || 'Thumbnail'}
          </p>
          <p className="text-xs text-gray-500">
            {[value.format?.toUpperCase(), formatBytes(value.bytes)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isBusy}
              className="text-sm text-primary-600 hover:text-primary-700 font-semibold disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isBusy}
              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={isBusy}
          onChange={(e) => upload(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isBusy) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!isBusy) upload(e.dataTransfer.files);
      }}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
        isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50'
      } ${isBusy ? 'opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        id="thumbnail"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={isBusy}
        onChange={(e) => upload(e.target.files)}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
          <p className="text-sm font-medium">Uploading...</p>
        </div>
      ) : (
        <>
          <span className="text-3xl block mb-2" aria-hidden="true">
            🖼️
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="text-primary-600 hover:text-primary-700 font-semibold disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Choose an image
          </button>
          <span className="text-gray-600"> or drag and drop</span>
          <p className="text-sm text-gray-500 mt-1">
            JPG, PNG or WEBP up to 5MB. A 16:9 image looks best.
          </p>
        </>
      )}
    </div>
  );
}
