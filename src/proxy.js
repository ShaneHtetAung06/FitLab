import { NextResponse } from 'next/server';

const protectedRoutes = ['/dashboard', '/chat', '/trainer'];
const adminRoutes = ['/admin'];
const authRoutes = ['/login', '/register'];


const PROTECTED_COURSE_PATH = /^\/courses\/[^/]+\/learn\/?$/;

const ADMIN_LOGIN = '/admin/login';


export function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  if (pathname === ADMIN_LOGIN) {
    return NextResponse.next();
  }

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      const adminLoginUrl = new URL(ADMIN_LOGIN, request.url);
      adminLoginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(adminLoginUrl);
    }
    return NextResponse.next();
  }

  if (
    protectedRoutes.some((route) => pathname.startsWith(route)) ||
    PROTECTED_COURSE_PATH.test(pathname)
  ) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/trainer/:path*',
    '/chat/:path*',
    '/courses/:id/learn',
    '/login',
    '/register',
  ],
};
