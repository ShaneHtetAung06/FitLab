import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, formatDuration } from '@/lib/courseOptions';


export default function CourseCard({ course, href, footer = null }) {
  const target = href || `/courses/${course._id}`;

  const meta = [
    course.totalLessons > 0 &&
      `${course.totalLessons} lesson${course.totalLessons === 1 ? '' : 's'}`,
    course.totalDuration > 0 && formatDuration(course.totalDuration),
    course.totalEnrollments > 0 &&
      `${course.totalEnrollments.toLocaleString('en-US')} student${
        course.totalEnrollments === 1 ? '' : 's'
      }`,
  ].filter(Boolean);

  return (
    <article className="card-hover group flex flex-col overflow-hidden rounded-card border border-ink-100 bg-white">
      {/* Clips the thumbnail's hover zoom. */}
      <Link
        href={target}
        className="relative block aspect-[16/10] overflow-hidden bg-bone"
      >
        {course.thumbnail ? (
          <Image
            src={course.thumbnail}
            alt=""
            fill
            className="object-cover transition-transform duration-[600ms] ease-soft group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-3xl transition-transform duration-[600ms] ease-soft group-hover:scale-110"
            aria-hidden="true"
          >
            🏋️
          </span>
        )}

        {course.category && (
          <span className="tag absolute left-3 top-3">{course.category}</span>
        )}

        {course.price === 0 && (
          <span className="tag tag-sale absolute right-3 top-3">Free</span>
        )}

        {course.level && (
          <span className="absolute bottom-3 right-3 text-[11px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
            {course.level}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {meta.length > 0 && (
          <p className="text-[11px] text-ink-400">{meta.join('  ·  ')}</p>
        )}

        <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug text-ink-900">
          <Link href={target} className="transition-colors group-hover:text-primary-600">
            {course.title}
          </Link>
        </h3>

        {course.description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-500">
            {course.description}
          </p>
        )}

        {course.trainer?.name && (
          <div className="mt-3 flex items-center gap-2">
            <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full bg-primary-50">
              {course.trainer.avatar ? (
                <Image
                  src={course.trainer.avatar}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="24px"
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-primary-700">
                  {course.trainer.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="truncate text-xs font-medium text-ink-700">
              {course.trainer.name}
            </span>
            {/* Only approved trainers can publish, so every course author is verified. */}
            <svg
              className="h-3.5 w-3.5 shrink-0 text-primary-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-label="Verified trainer"
              role="img"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
          {footer || (
            <>
              {course.totalReviews > 0 ? (
                <span className="flex items-center gap-1.5 text-[13px]">
                  <span className="text-primary-600" aria-hidden="true">
                    ★
                  </span>
                  <span className="font-semibold text-ink-900">
                    {Number(course.averageRating).toFixed(1)}
                  </span>
                  <span className="text-ink-400">({course.totalReviews})</span>
                  <span className="sr-only">
                    Rated {Number(course.averageRating).toFixed(1)} out of 5 from{' '}
                    {course.totalReviews} reviews
                  </span>
                </span>
              ) : (
                <span className="text-[13px] text-ink-400">No reviews yet</span>
              )}

              <span className="font-display text-lg font-bold text-ink-900">
                {formatPrice(course.price)}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
