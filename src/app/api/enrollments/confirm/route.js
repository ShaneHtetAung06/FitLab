import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import { authenticateRequest } from '@/lib/auth';
import { createEnrollment } from '@/lib/enrollment';
import { getStripe, isStripeConfigured, fromStripeAmount } from '@/lib/stripe';

/**
 * POST /api/enrollments/confirm
 *
 * Body: { sessionId }
 *
 * Called by the course page when the buyer returns from Stripe Checkout.
 *
 * The webhook is the authoritative path, but it needs `stripe listen` running in
 * development and can lag by a moment in production. Rather than showing a
 * freshly paying customer a locked course, this verifies the session directly
 * with Stripe and grants access. Both paths funnel through createEnrollment, so
 * whichever lands second is a no-op.
 */
export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.error) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Payments are not configured' },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Expected a JSON body' },
        { status: 400 }
      );
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json(
        { success: false, message: 'A valid Checkout session id is required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Checkout session not found' },
        { status: 404 }
      );
    }

    // The session id travels in a URL, so confirm it really belongs to the
    // caller before granting anything.
    if (String(session.metadata?.userId) !== String(auth.user._id)) {
      return NextResponse.json(
        { success: false, message: 'This payment belongs to another account' },
        { status: 403 }
      );
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          message: 'This payment has not completed yet',
          paymentStatus: session.payment_status,
        },
        { status: 409 }
      );
    }

    const courseId = session.metadata?.courseId;

    await dbConnect();

    const course = await Course.findById(courseId).select('_id title');

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Course not found' },
        { status: 404 }
      );
    }

    const { enrollment, created } = await createEnrollment({
      userId: auth.user._id,
      courseId: course._id,
      paymentId: String(session.payment_intent || session.id),
      amountPaid: fromStripeAmount(session.amount_total),
      stripeSessionId: session.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: created
          ? `You are enrolled in ${course.title}.`
          : 'You already have access to this course.',
        created,
        enrollment,
      },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    console.error('Confirm enrollment error:', error);
    return NextResponse.json(
      { success: false, message: 'Could not confirm your enrollment' },
      { status: 500 }
    );
  }
}
