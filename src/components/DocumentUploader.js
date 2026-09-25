'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  isPdfDocument,
  documentViewUrl,
  documentPreviewUrl,
  formatBytes,
} from '@/lib/documents';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];


export default function DocumentUploader({
  value = [],
  onChange,
  folder = 'trainerDocuments',
  maxFiles = 5,
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const remainingSlots = maxFiles - value.length;

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    if (files.length > remainingSlots) {
      toast.error(
        `You can upload ${remainingSlots} more file${remainingSlots === 1 ? '' : 's'}`
      );
      return;
    }

    // Validate on the client too, so obvious mistakes don't cost a round trip.
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" must be a JPG, PNG, WEBP or PDF`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" is larger than 5MB`);
        return;
      }
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('folder', folder);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        onChange([...value, ...data.files]);
        toast.success(data.message);
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

  const removeDocument = async (doc) => {
    // Drop it from the form straight away; Cloudinary cleanup is best effort.
    onChange(value.filter((item) => item.publicId !== doc.publicId));

    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: doc.publicId,
          resourceType: doc.resourceType,
        }),
      });
    } catch (error) {
      // The file is already off the form, so a failed cleanup is not worth
      // interrupting the user over.
      console.error('Failed to remove uploaded file:', error);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading || remainingSlots <= 0) return;
    uploadFiles(e.dataTransfer.files);
  };

  const isInputDisabled = disabled || isUploading || remainingSlots <= 0;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isInputDisabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 bg-gray-50'
        } ${isInputDisabled ? 'opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          id="documents"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          disabled={isInputDisabled}
          onChange={(e) => uploadFiles(e.target.files)}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        ) : (
          <>
            <span className="text-3xl block mb-2" aria-hidden="true">
              📄
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isInputDisabled}
              className="text-primary-600 hover:text-primary-700 font-semibold disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Choose files
            </button>
            <span className="text-gray-600"> or drag and drop</span>
            <p className="text-sm text-gray-500 mt-1">
              JPG, PNG, WEBP or PDF, up to 5MB each
            </p>
            <p className="text-sm text-gray-500">
              {remainingSlots > 0
                ? `${value.length} of ${maxFiles} uploaded`
                : `Maximum of ${maxFiles} files reached`}
            </p>
          </>
        )}
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((doc) => {
            const isPdf = isPdfDocument(doc);

            return (
              <li
                key={doc.publicId}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3"
              >
                <div className="relative w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src={documentPreviewUrl(doc)}
                    alt={doc.name || 'Uploaded document'}
                    width={48}
                    height={48}
                    className="w-12 h-12 object-cover"
                    unoptimized
                  />
                  {isPdf && (
                    <span
                      className="absolute bottom-0 right-0 text-[8px] font-semibold bg-gray-900/75 text-white px-1 rounded-tl"
                      aria-hidden="true"
                    >
                      PDF
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.name || doc.publicId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[doc.format?.toUpperCase(), formatBytes(doc.bytes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <a
                  href={documentViewUrl(doc)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium shrink-0"
                >
                  View
                </a>

                <button
                  type="button"
                  onClick={() => removeDocument(doc)}
                  disabled={disabled}
                  aria-label={`Remove ${doc.name || 'document'}`}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
