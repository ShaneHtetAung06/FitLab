import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
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
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: [true, 'Please provide a comment'],
      maxlength: [1000, 'Comment cannot be more than 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per course
reviewSchema.index({ user: 1, course: 1 }, { unique: true });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
