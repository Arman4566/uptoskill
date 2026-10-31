import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'NO_TOKEN'));
  try {
    req.userId = Number(jwt.verify(token, process.env.JWT_SECRET).sub);
    next();
  } catch {
    next(new AppError(401, 'BAD_TOKEN'));
  }
}
