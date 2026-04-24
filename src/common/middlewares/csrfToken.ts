import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Allow GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Paths that are excluded from CSRF (like login, according to user's answer)
  const excludedPaths = ['/api/auth/login'];
  if (excludedPaths.some(p => req.originalUrl.startsWith(p))) {
    return next();
  }

  const tokenInCookie = req.cookies?.csrfSecret;
  const tokenInHeader = req.headers['x-csrf-token'];

  if (!tokenInCookie || !tokenInHeader) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  // Double submit verification
  if (tokenInCookie !== tokenInHeader) {
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }

  next();
};

export const generateCsrfToken = (req: Request, res: Response): void => {
  const token = crypto.randomBytes(32).toString('hex');
  
  res.cookie('csrfSecret', token, {
    httpOnly: true, // Secure logic: Frontend reads from JSON response, but returns it via header. Backend compares header with this cookie.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  res.status(200).json({ csrfToken: token });
};
