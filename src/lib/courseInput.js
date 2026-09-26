
import { COURSE_CATEGORIES, COURSE_LEVELS, COURSE_LIMITS } from '@/lib/courseOptions';
import { isValidVideoUrl } from '@/lib/video';
import { validateDocumentReference, UPLOAD_FOLDERS } from '@/lib/cloudinary';

const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

function asString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeSections(rawSections) {
  if (!Array.isArray(rawSections)) {
    return { error: 'Sections must be a list' };
  }

  if (rawSections.length > COURSE_LIMITS.maxSections) {
    return { error: `A course can have at most ${COURSE_LIMITS.maxSections} sections` };
  }

  const sections = [];

  for (let s = 0; s < rawSections.length; s += 1) {
    const raw = rawSections[s] || {};
    const title = asString(raw.title).trim();

    if (!title) {
      return { error: `Section ${s + 1} needs a title` };
    }

    if (title.length > COURSE_LIMITS.sectionTitle) {
      return { error: `Section ${s + 1} title is too long` };
    }

    const rawLessons = Array.isArray(raw.lessons) ? raw.lessons : [];

    if (rawLessons.length > COURSE_LIMITS.maxLessonsPerSection) {
      return {
        error: `Section "${title}" has more than ${COURSE_LIMITS.maxLessonsPerSection} lessons`,
      };
    }

    const lessons = [];

    for (let l = 0; l < rawLessons.length; l += 1) {
      const rawLesson = rawLessons[l] || {};
      const lessonTitle = asString(rawLesson.title).trim();

      if (!lessonTitle) {
        return { error: `Lesson ${l + 1} in "${title}" needs a title` };
      }

      if (lessonTitle.length > COURSE_LIMITS.lessonTitle) {
        return { error: `Lesson "${lessonTitle.slice(0, 30)}..." title is too long` };
      }

      const content = asString(rawLesson.content);
      if (content.length > COURSE_LIMITS.lessonContent) {
        return { error: `Lesson "${lessonTitle}" content is too long` };
      }

      const videoUrl = asString(rawLesson.videoUrl).trim();
      if (!isValidVideoUrl(videoUrl)) {
        return {
          error: `Lesson "${lessonTitle}" has an invalid video link. Use a YouTube, Vimeo or direct video URL.`,
        };
      }

      if (!content.trim() && !videoUrl) {
        return {
          error: `Lesson "${lessonTitle}" needs either lesson text or a video link`,
        };
      }

      const duration = Number(rawLesson.duration);

      if (rawLesson.duration !== undefined && rawLesson.duration !== '' && Number.isNaN(duration)) {
        return { error: `Lesson "${lessonTitle}" has an invalid duration` };
      }

      if (duration < 0 || duration > COURSE_LIMITS.lessonDuration) {
        return {
          error: `Lesson "${lessonTitle}" duration must be between 0 and ${COURSE_LIMITS.lessonDuration} minutes`,
        };
      }

      lessons.push({
      
        ...(rawLesson._id ? { _id: rawLesson._id } : {}),
        title: lessonTitle,
        content,
        videoUrl,
        duration: Number.isFinite(duration) ? Math.round(duration) : 0,
        isPreview: Boolean(rawLesson.isPreview),
        order: l,
      });
    }

    sections.push({
      ...(raw._id ? { _id: raw._id } : {}),
      title,
      lessons,
      order: s,
    });
  }

  return { sections };
}

function normalizeThumbnail(raw) {
  if (raw === null) {
    return { thumbnail: '', thumbnailPublicId: '' };
  }

  if (!raw || typeof raw !== 'object') {
    return { error: 'Invalid thumbnail' };
  }

  const validation = validateDocumentReference(raw, UPLOAD_FOLDERS.courseThumbnails);
  if (validation.error) {
    return { error: validation.error };
  }

  // A PDF or video would break every <Image> that renders the course card.
  const format = asString(raw.format).toLowerCase();
  if (format && !IMAGE_FORMATS.includes(format)) {
    return { error: 'The thumbnail must be a JPG, PNG or WEBP image' };
  }

  return { thumbnail: raw.url, thumbnailPublicId: raw.publicId };
}


export function buildCourseData(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }

  const data = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  // Title
  if (!partial || has('title')) {
    const title = asString(body.title).trim();
    if (!title) return { error: 'Course title is required' };
    if (title.length > COURSE_LIMITS.title) {
      return { error: `Title cannot be more than ${COURSE_LIMITS.title} characters` };
    }
    data.title = title;
  }

  // Description
  if (!partial || has('description')) {
    const description = asString(body.description).trim();
    if (!description) return { error: 'Course description is required' };
    if (description.length > COURSE_LIMITS.description) {
      return {
        error: `Description cannot be more than ${COURSE_LIMITS.description} characters`,
      };
    }
    data.description = description;
  }

  // Price
  if (!partial || has('price')) {
    if (body.price === '' || body.price === null || body.price === undefined) {
      return { error: 'Course price is required' };
    }

    const price = Number(body.price);
    if (!Number.isFinite(price)) return { error: 'Price must be a number' };
    if (price < 0) return { error: 'Price cannot be negative' };
    if (price > COURSE_LIMITS.maxPrice) {
      return { error: `Price cannot be more than ${COURSE_LIMITS.maxPrice}` };
    }

    // Money is stored to the cent; more precision than that is a mistake.
    data.price = Math.round(price * 100) / 100;
  }

  // Category
  if (!partial || has('category')) {
    const category = asString(body.category).trim();
    if (!category) return { error: 'Category is required' };
    if (!COURSE_CATEGORIES.includes(category)) {
      return { error: 'Choose a valid category' };
    }
    data.category = category;
  }

  // Level
  if (!partial || has('level')) {
    const level = asString(body.level).trim() || 'All Levels';
    if (!COURSE_LEVELS.includes(level)) {
      return { error: 'Choose a valid level' };
    }
    data.level = level;
  }

  // Thumbnail
  if (has('thumbnail')) {
    const result = normalizeThumbnail(body.thumbnail);
    if (result.error) return { error: result.error };
    data.thumbnail = result.thumbnail;
    data.thumbnailPublicId = result.thumbnailPublicId;
  }

  // Sections
  if (!partial || has('sections')) {
    const result = normalizeSections(body.sections || []);
    if (result.error) return { error: result.error };
    data.sections = result.sections;
  }

  // Publish flag
  if (has('isPublished')) {
    data.isPublished = Boolean(body.isPublished);
  }

  return { data };
}
  
export function validateForPublishing(course) {
  if (!course.title?.trim()) return { error: 'Add a title before publishing' };
  if (!course.description?.trim()) {
    return { error: 'Add a description before publishing' };
  }
  if (!course.thumbnail) return { error: 'Add a thumbnail image before publishing' };

  const sections = course.sections || [];
  if (sections.length === 0) {
    return { error: 'Add at least one section before publishing' };
  }

  const lessonCount = sections.reduce(
    (sum, section) => sum + (section.lessons?.length || 0),
    0
  );

  if (lessonCount === 0) {
    return { error: 'Add at least one lesson before publishing' };
  }

  return { valid: true };
}
