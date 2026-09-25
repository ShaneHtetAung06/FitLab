import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/db';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}


function isTokenStale(user, decoded) {
  if (!user?.passwordChangedAt || !decoded?.iat) return false;
  return decoded.iat < Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    await dbConnect();
    const user = await User.findById(decoded.userId).select('-password');

    if (user?.isActive === false) return null;
    if (isTokenStale(user, decoded)) return null;

    return user;
  } catch (error) {
    return null;
  }
}

export async function authenticateRequest(request) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return { error: 'Not authenticated', status: 401 };
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return { error: 'Invalid or expired token', status: 401 };
    }

    await dbConnect();
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return { error: 'User not found', status: 401 };
    }


    if (user.isActive === false) {
      return { error: 'This account has been suspended', status: 403 };
    }

    if (isTokenStale(user, decoded)) {
      return {
        error: 'Your password was changed. Please sign in again.',
        status: 401,
      };
    }

    return { user };
  } catch (error) {
    return { error: 'Authentication failed', status: 401 };
  }
}

export function authorizeRoles(...roles) {
  return (user) => {
    if (!roles.includes(user.role)) {
      return { error: 'Not authorized to access this resource', status: 403 };
    }
    return { authorized: true };
  };
}

export async function authorizeRequest(request, ...roles) {
  const auth = await authenticateRequest(request);

  if (auth.error) return auth;

  const check = authorizeRoles(...roles)(auth.user);
  if (check.error) return check;

  return { user: auth.user };
}
