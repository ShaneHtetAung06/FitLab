import mongoose from 'mongoose';

// A lesson the learner has ticked off.
//
// Referenced by the lesson's own _id rather than by { sectionIndex, lessonIndex }.
// Positions shift whenever a trainer reorders or inserts a lesson, which would
// silently re-point a learner's progress at the wrong material.
const completedLessonSchema = new mongoose.Schema(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const enrollmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    // Stripe payment intent id, or 'free' for a zero-price course.
    paymentId: {
      type: String,
      required: true,
    },
    // Stripe Checkout session id. Kept so a replayed webhook, or the browser
    // returning from Checkout at the same time as the webhook arrives, cannot
    // create a second enrollment for one payment.
    stripeSessionId: {
      type: String,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: [0, 'Amount paid cannot be negative'],
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'refunded'],
      default: 'active',
    },
    progress: {
      completedLessons: {
        type: [completedLessonSchema],
        default: [],
      },
      lastAccessedAt: {
        type: Date,
        default: Date.now,
      },
    },
    // Set when every lesson has been completed.
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// One enrollment per learner per course.
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

// Partial rather than sparse: free enrollments have no session id, and a partial
// filter keeps those documents out of the unique index entirely.
enrollmentSchema.index(
  { stripeSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripeSessionId: { $type: 'string' } },
  }
);

enrollmentSchema.index({ course: 1, createdAt: -1 });
enrollmentSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Enrollment ||
  mongoose.model('Enrollment', enrollmentSchema);
