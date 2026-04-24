import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auditMiddleware = (eventType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      // Ignorar requisições com erro de validação/client-side erro dependendo do evento
      // Mas vamos logar sempre para ter o histórico, ou apenas se for sucesso?
      // O requisito diz "Grava audit_logs automaticamente".
      prisma.auditLog.create({
        data: {
          user_id: req.user?.sub || req.user?.id || null, // req.user pode ser populado se route for autenticada
          event_type: eventType,
          ip_address: req.ip || req.socket.remoteAddress || '',
          user_agent: req.headers['user-agent'] || '',
        }
      }).catch(err => console.error('Erro ao salvar audit log:', err));
    });

    next();
  };
};
