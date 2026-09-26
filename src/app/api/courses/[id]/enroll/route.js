import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import { authenticateRequest } from '@/lib/auth';
import { createEnrollment } from '@/lib/enrollment';
import {
  getStripe,
  isStripeConfigured,
  toStripeAmount,
  CURRENCY,
  getAppUrl,
} from '@/lib/stripe';

/**
 * POST /api/courses/[id]/enroll
 *
 * Starts enrollment in a course.
 *
 * Free courses are granted immediately. Paid courses return a Stripe Checkout
 * URL for the client to redirect to; the enrollment itself is only created once
 * Stripe confirms payment, via the webhook or the confirm endpoint.
 *
 * The charge is always built from the price stored on the course, never from
 * anything the client sends, so a tampered request cannot change what is paid.
 */
export async function POST(request, { params }) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid course id' },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findById(id).select(
      'title description thumbnail price isPublished trainer'
    );

    if (!course || !course.isPublished) {
      return NextResponse.json(
        { success: false, message: 'Course not found' },
        { status: 404 }
      );
    }

    const { user } = auth;

    /**
     * Admins cannot enrol.
     *
     * They already read every course in full for moderation (GET
     * /api/courses/[id] grants hasFullAccess on the strength of the role), so an
     * enrollment would buy them nothing while adding a paying-customer record
     * that skews the trainer's revenue and student numbers.
     *
     * Enforced here rather than only in the UI because this is the single point
     * where an enrollment begins: free courses are granted a few lines below,
     * and paid ones cannot reach the confirm or webhook paths without a Checkout
     * session, which is created after this check.
     */
    if (user.role === 'admin') {
      return NextResponse.json(
        {
          success: false,
          message:
            'Admin accounts cannot enrol in courses. You already have full access for moderation.',
        },
        { status: 403 }
      );
    }

    // A trainer already has full access to their own material.
    if (String(course.trainer) === String(user._id)) {
      return NextResponse.json(
        { success: false, message: 'You cannot enrol in your own course' },
        { status: 400 }
      );
    }

    const existing = await Enrollment.findOne({
      user: user._id,
      course: course._id,
    });

    if (existing && existing.status !== 'refunded') {
      return NextResponse.json(
        {
          success: false,
          message: 'You are already enrolled in this course',
          alreadyEnrolled: true,
        },
        { status: 409 }
      );
    }

    // Free course: grant access straight away, no payment step.
    if (course.price === 0) {
      const { enrollment } = await createEnrollment({
        userId: user._id,
        courseId: course._id,
        paymentId: 'free',
        amountPaid: 0,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'You are enrolled. Enjoy the course!',
          free: true,
          enrollment,
        },
        { status: 201 }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Payments are not configured. Add your Stripe credentials to .env.',
        },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Prefills Checkout and ties the payment to a real account.
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: toStripeAmount(course.price),
            product_data: {
              name: course.title,
              // Stripe rejects an empty string here.
              ...(course.description
                ? { description: course.description.slice(0, 500) }
                : {}),
              ...(course.thumbnail ? { images: [course.thumbnail] } : {}),
            },
          },
        },
      ],
      // Read back by the webhook and the confirm endpoint to know who bought what.
      metadata: {
        courseId: String(course._id),
        userId: String(user._id),
      },
      success_url: `${appUrl}/courses/${course._id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/courses/${course._id}?checkout=cancelled`,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Redirecting to secure checkout',
        checkoutUrl: session.url,
        sessionId: session.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Enroll error:', error);
    return NextResponse.json(
      { success: false, message: 'Could not start enrollment' },
      { status: 500 }
    );
  }
}
