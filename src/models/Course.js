import mongoose from 'mongoose';
import { isValidVideoUrl } from '@/lib/video';
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  COURSE_LIMITS,
} from '@/lib/courseOptions';

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true,
    maxlength: [
      COURSE_LIMITS.lessonTitle,
      `Lesson title cannot be more than ${COURSE_LIMITS.lessonTitle} characters`,
    ],
  },
  // Written lesson material. Generous limit so trainers can write full guides.
  content: {
    type: String,
    default: '',
    maxlength: [
      COURSE_LIMITS.lessonContent,
      `Lesson content cannot be more than ${COURSE_LIMITS.lessonContent} characters`,
    ],
  },
  videoUrl: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: isValidVideoUrl,
      message: 'Provide a valid video link (YouTube, Vimeo or a direct video URL)',
    },
  },
  // Rough length in minutes, used for the course total shown to learners.
  duration: {
    type: Number,
    default: 0,
    min: [0, 'Duration cannot be negative'],
    max: [COURSE_LIMITS.lessonDuration, 'A lesson cannot be longer than 24 hours'],
  },
  // Lets a trainer open one lesson as a free sample before purchase.
  isPreview: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    required: true,
  },
});

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Section title is required'],
    trim: true,
    maxlength: [
      COURSE_LIMITS.sectionTitle,
      `Section title cannot be more than ${COURSE_LIMITS.sectionTitle} characters`,
    ],
  },
  lessons: [lessonSchema],
  order: {
    type: Number,
    required: true,
  },
});

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      maxlength: [
        COURSE_LIMITS.title,
        `Title cannot be more than ${COURSE_LIMITS.title} characters`,
      ],
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
      maxlength: [
        COURSE_LIMITS.description,
        `Description cannot be more than ${COURSE_LIMITS.description} characters`,
      ],
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    price: {
      type: Number,
      required: [true, 'Course price is required'],
      min: [0, 'Price cannot be negative'],
      max: [
        COURSE_LIMITS.maxPrice,
        `Price cannot be more than ${COURSE_LIMITS.maxPrice}`,
      ],
    },
    // Delivery URL of the thumbnail image.
    thumbnail: {
      type: String,
      default: '',
    },
    // Kept alongside the URL so the old image can be removed from Cloudinary
    // when the thumbnail is replaced or the course is deleted.
    thumbnailPublicId: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: COURSE_CATEGORIES,
    },
    level: {
      type: String,
      enum: COURSE_LEVELS,
      default: 'All Levels',
    },
    sections: [sectionSchema],
    isPublished: {
      type: Boolean,
      default: false,
    },
    // Set the first time a course goes live, so analytics can show how long it
    // has been earning rather than how long ago it was drafted.
    publishedAt: {
      type: Date,
    },
    totalEnrollments: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Handy for list and analytics views without walking sections in every caller.
courseSchema.virtual('totalLessons').get(function () {
  return (this.sections || []).reduce(
    (sum, section) => sum + (section.lessons?.length || 0),
    0
  );
});

courseSchema.virtual('totalDuration').get(function () {
  return (this.sections || []).reduce(
    (sum, section) =>
      sum +
      (section.lessons || []).reduce(
        (lessonSum, lesson) => lessonSum + (lesson.duration || 0),
        0
      ),
    0
  );
});

// Stamp publishedAt the first time the course is published.
courseSchema.pre('save', function (next) {
  if (this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1 });
courseSchema.index({ trainer: 1 });
courseSchema.index({ price: 1 });
courseSchema.index({ isPublished: 1, createdAt: -1 });

export default mongoose.models.Course || mongoose.model('Course', courseSchema);
