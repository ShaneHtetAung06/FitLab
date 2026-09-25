import mongoose from 'mongoose';

// A single certificate / document uploaded to Cloudinary.
// publicId is kept so the asset can be deleted when a request is withdrawn.
const documentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: '',
    },
    format: {
      type: String,
      default: '',
    },
    bytes: {
      type: Number,
      default: 0,
    },
    resourceType: {
      type: String,
      default: 'image',
    },
  },
  { _id: false }
);

const trainerRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    qualifications: {
      type: String,
      required: [true, 'Please provide your qualifications'],
      maxlength: [2000, 'Qualifications cannot be more than 2000 characters'],
    },
    experience: {
      type: String,
      required: [true, 'Please describe your experience'],
      maxlength: [2000, 'Experience cannot be more than 2000 characters'],
    },
    specialties: {
      type: String,
      required: [true, 'Please list your specialties'],
    },
    documents: {
      type: [documentSchema],
      validate: {
        validator: (docs) => Array.isArray(docs) && docs.length > 0 && docs.length <= 5,
        message: 'Please upload between 1 and 5 documents',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters'],
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

trainerRequestSchema.index({ user: 1 });
trainerRequestSchema.index({ status: 1 });
trainerRequestSchema.index({ createdAt: -1 });

// At most one open application per user. Partial index so approved/rejected
// history is kept and a rejected applicant can apply again.
trainerRequestSchema.index(
  { user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

export default mongoose.models.TrainerRequest ||
  mongoose.model('TrainerRequest', trainerRequestSchema);
