'use client';

import { parseVideoUrl } from '@/lib/video';


export default function VideoEmbed({ url, title = 'Lesson video' }) {
  const video = parseVideoUrl(url);

  if (!video.provider) return null;

  if (video.provider === 'file') {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={video.url} controls className="w-full h-full" preload="metadata">
          <a href={video.url}>Download the video</a>
        </video>
      </div>
    );
  }

  if (video.provider === 'link') {
    return (
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
      >
        <span aria-hidden="true">▶</span>
        Open the video in a new tab
      </a>
    );
  }

  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
      <iframe
        src={video.embedUrl}
        title={title}
        className="w-full h-full"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
