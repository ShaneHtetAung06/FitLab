'use client';

import Image from 'next/image';

const SIZES = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-11 w-11 text-base',
};

/**
 * Round avatar for a chat participant, falling back to the initial the way the
 * navbar does when a user has no uploaded image.
 */
export default function ChatAvatar({ name, avatar, size = 'sm', online = false }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  return (
    <span className="relative inline-block shrink-0">
      <span
        className={`${SIZES[size] || SIZES.sm} relative block overflow-hidden rounded-full bg-primary-50`}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            fill
            className="object-cover"
            sizes="44px"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-semibold text-primary-700">
            {initial}
          </span>
        )}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-accent-500"
          aria-hidden="true"
        />
      )}
    </span>
  );
}
