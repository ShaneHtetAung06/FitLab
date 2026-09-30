import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      maxlength: [2000, 'Message cannot be more than 2000 characters'],
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

chatMessageSchema.index({ sender: 1, receiver: 1 });
chatMessageSchema.index({ course: 1 });
chatMessageSchema.index({ createdAt: -1 });

// Reading a thread is a symmetric query -- { course, $or: [{sender:a,receiver:b},
// {sender:b,receiver:a}] } sorted newest first -- which the { sender, receiver }
// index above cannot serve, because it neither filters on course nor supplies the
// sort order. Each $or branch matches this one on an exact prefix and then reads
// the sort straight off the index.
chatMessageSchema.index({ course: 1, sender: 1, receiver: 1, createdAt: -1 });

// Backs the unread badge, which counts a single user's inbound unread messages on
// every page load, and the updateMany that clears them when a thread is opened.
chatMessageSchema.index({ receiver: 1, read: 1 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
