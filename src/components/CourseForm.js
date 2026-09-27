'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ThumbnailUploader from '@/components/ThumbnailUploader';
import CurriculumEditor, {
  createSection,
  sectionsToEditorState,
  editorStateToPayload,
} from '@/components/CurriculumEditor';
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  COURSE_LIMITS,
  formatPrice,
} from '@/lib/courseOptions';
import { isValidVideoUrl } from '@/lib/video';

const inputClass =
  'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all';

/**
 * Shared create/edit form for a course.
 *
 * @param {object}   [course]   existing course when editing
 * @param {Function} onSubmit   async ({ payload, isPublished }) => boolean success
 * @param {string}   submitLabel
 * @param {Function} [onDelete] shows a delete control when provided
 */
export default function CourseForm({
  course = null,
  onSubmit,
  submitLabel = 'Save course',
  onDelete = null,
}) {
  const isEditing = Boolean(course);

  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [price, setPrice] = useState(
    course?.price === undefined || course?.price === null ? '' : String(course.price)
  );
  const [category, setCategory] = useState(course?.category || '');
  const [level, setLevel] = useState(course?.level || 'All Levels');
  const [thumbnail, setThumbnail] = useState(
    course?.thumbnail
      ? {
          url: course.thumbnail,
          publicId: course.thumbnailPublicId || '',
          name: 'Current thumbnail',
        }
      : null
  );
  const [sections, setSections] = useState(
    isEditing ? sectionsToEditorState(course.sections) : [createSection()]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  /**
   * Client-side checks that mirror the API rules, so a trainer gets told what is
   * wrong before a round trip. The server validates again regardless.
   */
  const validate = ({ publishing }) => {
    if (!title.trim()) return 'Please add a course title';
    if (!description.trim()) return 'Please add a course description';
    if (!category) return 'Please choose a category';

    if (price === '') return 'Please set a price (use 0 for a free course)';
    const priceValue = Number(price);
    if (!Number.isFinite(priceValue)) return 'Price must be a number';
    if (priceValue < 0) return 'Price cannot be negative';
    if (priceValue > COURSE_LIMITS.maxPrice) {
      return `Price cannot be more than ${COURSE_LIMITS.maxPrice}`;
    }

    for (let s = 0; s < sections.length; s += 1) {
      const section = sections[s];
      if (!section.title.trim()) return `Section ${s + 1} needs a title`;

      for (let l = 0; l < section.lessons.length; l += 1) {
        const lesson = section.lessons[l];
        const label = lesson.title.trim() || `Lesson ${l + 1}`;

        if (!lesson.title.trim()) {
          return `Lesson ${l + 1} in "${section.title.trim()}" needs a title`;
        }
        if (!isValidVideoUrl(lesson.videoUrl.trim())) {
          return `"${label}" has an invalid video link`;
        }
        if (!lesson.content.trim() && !lesson.videoUrl.trim()) {
          return `"${label}" needs either lesson text or a video link`;
        }
      }
    }

    if (publishing) {
      if (!thumbnail?.url) return 'Add a thumbnail image before publishing';
      const lessonCount = sections.reduce(
        (sum, section) => sum + section.lessons.length,
        0
      );
      if (lessonCount === 0) return 'Add at least one lesson before publishing';
    }

    return null;
  };

  const submit = async (isPublished) => {
    const error = validate({ publishing: isPublished });

    if (error) {
      toast.error(error);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      category,
      level,
      sections: editorStateToPayload(sections),
      isPublished,
    };

    // Only send the thumbnail key when it changed, so an untouched course keeps
    // its existing image without the client having to know the publicId.
    const originalThumbnail = course?.thumbnail || null;
    if (!thumbnail?.url) {
      if (originalThumbnail) payload.thumbnail = null;
    } else if (thumbnail.url !== originalThumbnail) {
      payload.thumbnail = {
        url: thumbnail.url,
        publicId: thumbnail.publicId,
        format: thumbnail.format,
        name: thumbnail.name,
        bytes: thumbnail.bytes,
        resourceType: thumbnail.resourceType,
      };
    }

    setIsSubmitting(true);
    setPendingAction(isPublished ? 'publish' : 'draft');

    try {
      await onSubmit({ payload, isPublished });
    } finally {
      setIsSubmitting(false);
      setPendingAction(null);
    }
  };

  const priceValue = Number(price);
  const showsPricePreview = price !== '' && Number.isFinite(priceValue) && priceValue >= 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Enter in a text field should do the safe thing, not publish.
        submit(Boolean(course?.isPublished));
      }}
      className="space-y-6"
    >
      {/* Basics */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Course basics</h2>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="course-title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title
            </label>
            <input
              id="course-title"
              type="text"
              required
              value={title}
              maxLength={COURSE_LIMITS.title}
              disabled={isSubmitting}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Full Body Strength in 6 Weeks"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              {title.length}/{COURSE_LIMITS.title}
            </p>
          </div>

          <div>
            <label
              htmlFor="course-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="course-description"
              required
              rows={5}
              value={description}
              maxLength={COURSE_LIMITS.description}
              disabled={isSubmitting}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who the course is for, what they will achieve, and what they need to get started"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              {description.length}/{COURSE_LIMITS.description}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="course-category"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Category
              </label>
              <select
                id="course-category"
                required
                value={category}
                disabled={isSubmitting}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">Choose a category</option>
                {COURSE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-level"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Level
              </label>
              <select
                id="course-level"
                value={level}
                disabled={isSubmitting}
                onChange={(e) => setLevel(e.target.value)}
                className={inputClass}
              >
                {COURSE_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="course-price"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Price (USD)
            </label>
            <input
              id="course-price"
              type="number"
              required
              min={0}
              max={COURSE_LIMITS.maxPrice}
              step="0.01"
              value={price}
              disabled={isSubmitting}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} sm:max-w-xs`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {showsPricePreview
                ? `Learners will see ${formatPrice(priceValue)}`
                : 'Enter 0 to offer the course for free'}
            </p>
          </div>
        </div>
      </section>

      {/* Thumbnail */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Thumbnail</h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          The cover image shown on course cards. Required before publishing.
        </p>
        <ThumbnailUploader
          value={thumbnail}
          onChange={setThumbnail}
          disabled={isSubmitting}
        />
      </section>

      {/* Curriculum */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Curriculum</h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          Group your lessons into sections. Each lesson can hold a video link,
          written instructions, or both.
        </p>
        <CurriculumEditor
          value={sections}
          onChange={setSections}
          disabled={isSubmitting}
        />
      </section>

      {/* Actions */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center gap-3">
          {course?.isPublished ? (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submit(true)}
                className="bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && pendingAction === 'publish'
                  ? 'Saving...'
                  : 'Save changes'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submit(false)}
                className="border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isSubmitting && pendingAction === 'draft'
                  ? 'Unpublishing...'
                  : 'Unpublish'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submit(true)}
                className="bg-accent-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && pendingAction === 'publish'
                  ? 'Publishing...'
                  : 'Publish course'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submit(false)}
                className="border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isSubmitting && pendingAction === 'draft'
                  ? 'Saving...'
                  : submitLabel}
              </button>
            </>
          )}

          <Link
            href="/trainer/courses"
            className="text-gray-600 hover:text-gray-900 font-medium ml-auto"
          >
            Cancel
          </Link>
        </div>

        {!course?.isPublished && (
          <p className="text-sm text-gray-500 mt-3">
            Drafts stay hidden from learners until you publish them.
          </p>
        )}

        {onDelete && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onDelete}
              className="text-sm text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
            >
              Delete this course
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Only possible while no one has enrolled.
            </p>
          </div>
        )}
      </section>
    </form>
  );
}
