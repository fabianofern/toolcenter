import { Request, Response, NextFunction } from 'express';

export const verifyOwnershipOrAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const userIdFromUrl = req.params.id;
  const loggedInUserId = req.user?.sub;
  const userRole = req.user?.portal_role;

  if (userRole === 'ADMINISTRADOR') {
    return next();
  }

  if (userIdFromUrl && loggedInUserId === userIdFromUrl) {
    return next();
  }

  res.status(403).json({ error: 'Acesso negado: IDOR protection prevented action.' });
};
