import { Request, Response, NextFunction } from 'express';

export const requireToolAccess = (toolSlug: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.tools_access) {
      res.status(403).json({ error: 'Acesso negado ou token injetado errado.' });
      return;
    }

    const toolAccess = req.user.tools_access.find((access: any) => access.tool_slug === toolSlug);

    if (!toolAccess) {
      res.status(403).json({ error: `O usuário não possui as permissões necessárias para acessar ${toolSlug}.` });
      return;
    }

    // Injeta a role encontrada para os próximos steps utilizarem.
    req.body.toolRole = toolAccess.tool_role; // You could also augment Express.Request like req.toolRole

    next();
  };
};
