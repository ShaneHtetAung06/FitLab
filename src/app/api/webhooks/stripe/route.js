import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Enrollment from '@/models/Enrollment';
import {
  getStripe,
  isStripeConfigured,
  isStripeWebhookConfigured,
  fromStripeAmount,
} from '@/lib/stripe';
import { createEnrollment, recalculateCourseEnrollments } from '@/lib/enrollment';


export const dynamic = 'force-dynamic';


export async function POST(request) {
  if (!isStripeConfigured() || !isStripeWebhookConfigured()) {
    return NextResponse.json(
      { success: false, message: 'Stripe webhooks are not configured' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { success: false, message: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {

    console.error('Stripe webhook signature verification failed:', error.message);
    return NextResponse.json(
      { success: false, message: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    switch (event.type) {
      case 'checkout.session.completed': {
        await grantAccessFromSession(event.data.object);
        break;
      }

      case 'charge.refunded': {
        await markRefunded(event.data.object);
        break;
      }

      default:
     
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // A 500 tells Stripe to retry, which is what we want for a transient fault.
    console.error('Stripe webhook handling error:', error);
    return NextResponse.json(
      { success: false, message: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function grantAccessFromSession(session) {
  if (session.payment_status !== 'paid') return;

  const courseId = session.metadata?.courseId;
  const userId = session.metadata?.userId;

  if (!courseId || !userId) {
    console.error('Stripe session is missing metadata:', session.id);
    return;
  }

  if (
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    console.error('Stripe session carries invalid ids:', session.id);
    return;
  }

  await createEnrollment({
    userId,
    courseId,
    paymentId: String(session.payment_intent || session.id),
    amountPaid: fromStripeAmount(session.amount_total),
    stripeSessionId: session.id,
  });
}

/** Revokes access when Stripe reports a refund. */
async function markRefunded(charge) {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  const enrollment = await Enrollment.findOne({ paymentId: String(paymentIntentId) });
  if (!enrollment || enrollment.status === 'refunded') return;

  enrollment.status = 'refunded';
  await enrollment.save();

  // Keeps the buyer count on the course honest.
  await recalculateCourseEnrollments(enrollment.course);
}
