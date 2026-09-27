'use client';

import { useState } from 'react';
import { COURSE_LIMITS, formatDuration } from '@/lib/courseOptions';
import { parseVideoUrl, videoProviderLabel } from '@/lib/video';

/** Stable client-side key so React list items survive reordering. */
let keyCounter = 0;
function nextKey(prefix) {
  keyCounter += 1;
  return `${prefix}-${Date.now()}-${keyCounter}`;
}

export function createLesson() {
  return {
    key: nextKey('lesson'),
    title: '',
    content: '',
    videoUrl: '',
    duration: '',
    isPreview: false,
  };
}

export function createSection() {
  return {
    key: nextKey('section'),
    title: '',
    lessons: [createLesson()],
  };
}

/**
 * Turns a course loaded from the API into editor state.
 *
 * The existing _id of each section and lesson is carried through so saving an
 * edit updates the same subdocuments instead of replacing them, which keeps any
 * learner progress recorded against them intact.
 */
export function sectionsToEditorState(sections) {
  const list = Array.isArray(sections) ? sections : [];

  if (list.length === 0) return [createSection()];

  return list.map((section) => ({
    key: nextKey('section'),
    _id: section._id,
    title: section.title || '',
    lessons: (section.lessons || []).map((lesson) => ({
      key: nextKey('lesson'),
      _id: lesson._id,
      title: lesson.title || '',
      content: lesson.content || '',
      videoUrl: lesson.videoUrl || '',
      duration: lesson.duration ? String(lesson.duration) : '',
      isPreview: Boolean(lesson.isPreview),
    })),
  }));
}

/** Strips editor-only fields before the payload goes to the API. */
export function editorStateToPayload(sections) {
  return sections.map((section) => ({
    ...(section._id ? { _id: section._id } : {}),
    title: section.title.trim(),
    lessons: section.lessons.map((lesson) => ({
      ...(lesson._id ? { _id: lesson._id } : {}),
      title: lesson.title.trim(),
      content: lesson.content,
      videoUrl: lesson.videoUrl.trim(),
      duration: lesson.duration === '' ? 0 : Number(lesson.duration),
      isPreview: Boolean(lesson.isPreview),
    })),
  }));
}

const inputClass =
  'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all';

function MoveButtons({ index, total, onMove, label }) {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        className="p-1.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === total - 1}
        aria-label={`Move ${label} down`}
        className="p-1.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Editor for a course's sections and lessons.
 *
 * @param {object[]} value     editor state from sectionsToEditorState/createSection
 * @param {Function} onChange  receives the next state
 * @param {boolean}  disabled
 */
export default function CurriculumEditor({ value = [], onChange, disabled = false }) {
  // Collapsed by default once a course gets large, so the page stays navigable.
  const [collapsed, setCollapsed] = useState({});

  const update = (next) => onChange(next);

  const move = (list, from, to) => {
    if (to < 0 || to >= list.length) return list;
    const copy = [...list];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };

  const addSection = () => {
    if (value.length >= COURSE_LIMITS.maxSections) return;
    update([...value, createSection()]);
  };

  const removeSection = (index) => {
    update(value.filter((_, i) => i !== index));
  };

  const patchSection = (index, patch) => {
    update(value.map((section, i) => (i === index ? { ...section, ...patch } : section)));
  };

  const moveSection = (from, to) => update(move(value, from, to));

  const addLesson = (sectionIndex) => {
    const section = value[sectionIndex];
    if (section.lessons.length >= COURSE_LIMITS.maxLessonsPerSection) return;
    patchSection(sectionIndex, { lessons: [...section.lessons, createLesson()] });
  };

  const removeLesson = (sectionIndex, lessonIndex) => {
    const section = value[sectionIndex];
    patchSection(sectionIndex, {
      lessons: section.lessons.filter((_, i) => i !== lessonIndex),
    });
  };

  const patchLesson = (sectionIndex, lessonIndex, patch) => {
    const section = value[sectionIndex];
    patchSection(sectionIndex, {
      lessons: section.lessons.map((lesson, i) =>
        i === lessonIndex ? { ...lesson, ...patch } : lesson
      ),
    });
  };

  const moveLesson = (sectionIndex, from, to) => {
    const section = value[sectionIndex];
    patchSection(sectionIndex, { lessons: move(section.lessons, from, to) });
  };

  const totalLessons = value.reduce((sum, section) => sum + section.lessons.length, 0);
  const totalDuration = value.reduce(
    (sum, section) =>
      sum +
      section.lessons.reduce(
        (lessonSum, lesson) => lessonSum + (Number(lesson.duration) || 0),
        0
      ),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-600">
          {value.length} section{value.length === 1 ? '' : 's'} · {totalLessons} lesson
          {totalLessons === 1 ? '' : 's'} · {formatDuration(totalDuration)} total
        </p>
        {value.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setCollapsed((prev) => {
                const allCollapsed = value.every((section) => prev[section.key]);
                if (allCollapsed) return {};
                return Object.fromEntries(value.map((section) => [section.key, true]));
              })
            }
            className="text-sm text-gray-600 hover:text-primary-600 font-medium"
          >
            {value.every((section) => collapsed[section.key])
              ? 'Expand all'
              : 'Collapse all'}
          </button>
        )}
      </div>

      {value.map((section, sectionIndex) => {
        const isCollapsed = Boolean(collapsed[section.key]);
        const sectionLessons = section.lessons.length;

        return (
          <div
            key={section.key}
            className="border border-gray-200 rounded-xl bg-white overflow-hidden"
          >
            {/* Section header */}
            <div className="flex items-start gap-2 p-4 bg-gray-50 border-b border-gray-200">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [section.key]: !isCollapsed }))
                }
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                className="mt-2.5 p-1 text-gray-500 hover:text-primary-600 shrink-0"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`section-title-${section.key}`}
                  className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
                >
                  Section {sectionIndex + 1}
                </label>
                <input
                  id={`section-title-${section.key}`}
                  type="text"
                  value={section.title}
                  maxLength={COURSE_LIMITS.sectionTitle}
                  disabled={disabled}
                  onChange={(e) => patchSection(sectionIndex, { title: e.target.value })}
                  placeholder="e.g. Getting started"
                  className={inputClass}
                />
                {isCollapsed && (
                  <p className="text-xs text-gray-500 mt-1">
                    {sectionLessons} lesson{sectionLessons === 1 ? '' : 's'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 mt-6 shrink-0">
                <MoveButtons
                  index={sectionIndex}
                  total={value.length}
                  onMove={moveSection}
                  label="section"
                />
                <button
                  type="button"
                  onClick={() => removeSection(sectionIndex)}
                  disabled={disabled || value.length === 1}
                  aria-label={`Remove section ${sectionIndex + 1}`}
                  title={
                    value.length === 1
                      ? 'A course needs at least one section'
                      : 'Remove section'
                  }
                  className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
                >
                  <svg
                    className="w-4 h-4"
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
              </div>
            </div>

            {/* Lessons */}
            {!isCollapsed && (
              <div className="p-4 space-y-4">
                {section.lessons.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    No lessons yet. Add the first one below.
                  </p>
                )}

                {section.lessons.map((lesson, lessonIndex) => {
                  const video = parseVideoUrl(lesson.videoUrl);
                  const hasVideoError = Boolean(lesson.videoUrl.trim()) && !video.provider;

                  return (
                    <div
                      key={lesson.key}
                      className="border border-gray-200 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`lesson-title-${lesson.key}`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Lesson {lessonIndex + 1} title
                          </label>
                          <input
                            id={`lesson-title-${lesson.key}`}
                            type="text"
                            value={lesson.title}
                            maxLength={COURSE_LIMITS.lessonTitle}
                            disabled={disabled}
                            onChange={(e) =>
                              patchLesson(sectionIndex, lessonIndex, {
                                title: e.target.value,
                              })
                            }
                            placeholder="e.g. Warm-up routine"
                            className={inputClass}
                          />
                        </div>

                        <div className="flex items-center gap-1 mt-7 shrink-0">
                          <MoveButtons
                            index={lessonIndex}
                            total={section.lessons.length}
                            onMove={(from, to) => moveLesson(sectionIndex, from, to)}
                            label="lesson"
                          />
                          <button
                            type="button"
                            onClick={() => removeLesson(sectionIndex, lessonIndex)}
                            disabled={disabled}
                            aria-label={`Remove lesson ${lessonIndex + 1}`}
                            className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"
                          >
                            <svg
                              className="w-4 h-4"
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
                        </div>
                      </div>

                      {/* Video link */}
                      <div>
                        <label
                          htmlFor={`lesson-video-${lesson.key}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Video link{' '}
                          <span className="font-normal text-gray-500">(optional)</span>
                        </label>
                        <input
                          id={`lesson-video-${lesson.key}`}
                          type="url"
                          value={lesson.videoUrl}
                          disabled={disabled}
                          onChange={(e) =>
                            patchLesson(sectionIndex, lessonIndex, {
                              videoUrl: e.target.value,
                            })
                          }
                          placeholder="https://www.youtube.com/watch?v=..."
                          aria-invalid={hasVideoError}
                          aria-describedby={`lesson-video-help-${lesson.key}`}
                          className={`${inputClass} ${
                            hasVideoError
                              ? 'border-red-300 focus:ring-red-500'
                              : ''
                          }`}
                        />
                        <p
                          id={`lesson-video-help-${lesson.key}`}
                          className={`text-xs mt-1 ${
                            hasVideoError ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          {hasVideoError
                            ? 'That does not look like a valid link. Paste a YouTube, Vimeo or direct video URL.'
                            : video.provider
                              ? `Detected: ${videoProviderLabel(lesson.videoUrl)}`
                              : 'Paste a YouTube, Vimeo or direct video file URL.'}
                        </p>

                        {video.embedUrl && video.provider !== 'file' && (
                          <div className="mt-2 aspect-video w-full max-w-md rounded-lg overflow-hidden border border-gray-200 bg-black">
                            <iframe
                              src={video.embedUrl}
                              title={`Preview of ${lesson.title || 'lesson video'}`}
                              className="w-full h-full"
                              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>

                      {/* Lesson text */}
                      <div>
                        <label
                          htmlFor={`lesson-content-${lesson.key}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Lesson text
                        </label>
                        <textarea
                          id={`lesson-content-${lesson.key}`}
                          rows={5}
                          value={lesson.content}
                          maxLength={COURSE_LIMITS.lessonContent}
                          disabled={disabled}
                          onChange={(e) =>
                            patchLesson(sectionIndex, lessonIndex, {
                              content: e.target.value,
                            })
                          }
                          placeholder="Instructions, sets and reps, coaching cues, things to watch out for..."
                          className={inputClass}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {lesson.content.length}/{COURSE_LIMITS.lessonContent} · a lesson
                          needs text, a video, or both
                        </p>
                      </div>

                      <div className="flex flex-wrap items-end gap-6">
                        <div className="w-36">
                          <label
                            htmlFor={`lesson-duration-${lesson.key}`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Length (minutes)
                          </label>
                          <input
                            id={`lesson-duration-${lesson.key}`}
                            type="number"
                            min={0}
                            max={COURSE_LIMITS.lessonDuration}
                            value={lesson.duration}
                            disabled={disabled}
                            onChange={(e) =>
                              patchLesson(sectionIndex, lessonIndex, {
                                duration: e.target.value,
                              })
                            }
                            placeholder="0"
                            className={inputClass}
                          />
                        </div>

                        <label className="flex items-center gap-2 pb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lesson.isPreview}
                            disabled={disabled}
                            onChange={(e) =>
                              patchLesson(sectionIndex, lessonIndex, {
                                isPreview: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">
                            Free preview
                            <span className="text-gray-500">
                              {' '}
                              — anyone can watch this before buying
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addLesson(sectionIndex)}
                  disabled={
                    disabled ||
                    section.lessons.length >= COURSE_LIMITS.maxLessonsPerSection
                  }
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
                >
                  + Add lesson
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addSection}
        disabled={disabled || value.length >= COURSE_LIMITS.maxSections}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
      >
        + Add section
      </button>
    </div>
  );
}
