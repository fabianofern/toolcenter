import { Request, Response, NextFunction } from 'express';

export const requirePortalRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.portal_role) {
      res.status(403).json({ error: 'Acesso negado. Perfil não encontrado.' });
      return;
    }

    if (!roles.includes(req.user.portal_role)) {
      res.status(403).json({ error: 'Acesso negado. Nível de permissão insuficiente.' });
      return;
    }

    next();
  };
};
