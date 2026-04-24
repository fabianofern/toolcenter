declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../modules/auth/services/token.service';
import { isBlacklisted } from '../../modules/auth/services/blacklist.service';

export const validateJwtCookie = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const decoded = verifyToken(token);
    
    if (decoded.jti) {
      const blacklisted = await isBlacklisted(decoded.jti);
      if (blacklisted) {
        res.status(401).json({ error: 'Sessão revogada' });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
