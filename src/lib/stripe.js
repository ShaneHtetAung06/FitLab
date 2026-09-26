import Stripe from 'stripe';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const PLACEHOLDER_VALUES = [
  'your_stripe_secret_key_here',
  'sk_test_your_key_here',
  'your_stripe_webhook_secret_here',
];

function isUsable(value) {
  return Boolean(value) && !PLACEHOLDER_VALUES.includes(value);
}

export function isStripeConfigured() {
  return isUsable(SECRET_KEY);
}

export function isStripeWebhookConfigured() {
  return isUsable(process.env.STRIPE_WEBHOOK_SECRET);
}

let client = null;

export function getStripe() {
  if (!isStripeConfigured()) return null;

  if (!client) {
    client = new Stripe(SECRET_KEY, {

      apiVersion: '2024-06-20',
    });
  }

  return client;
}


export function toStripeAmount(price) {
  return Math.round((Number(price) || 0) * 100);
}

export function fromStripeAmount(amount) {
  return Math.round(Number(amount) || 0) / 100;
}

export const CURRENCY = 'usd';

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/+$/,
    ''
  );
}
