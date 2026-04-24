import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const listLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const { userId, eventType, toolId, dateFrom, dateTo } = req.query;

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.user_id = userId as string;
    if (eventType) where.event_type = eventType as string;
    if (toolId) where.tool_id = toolId as string;
    
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom as string);
      if (dateTo) where.created_at.lte = new Date(dateTo as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          tool: { select: { name: true, slug: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.status(200).json({
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('List logs err:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const trackExternalEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { toolSlug, userId, action, metadata } = req.body;

    const tool = await prisma.tool.findUnique({ where: { slug: toolSlug } });
    if (!tool) {
       res.status(404).json({ error: 'Ferramenta inacessível ou slug inválido' });
       return;
    }

    // --- Limite de armazenamento de logs por 15 dias ---
    try {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      await prisma.auditLog.deleteMany({
        where: {
          created_at: { lt: fifteenDaysAgo }
        }
      });
    } catch (cleanupErr) {
      console.error('Failed to cleanup old logs:', cleanupErr);
    }
    // --------------------------------------------------

    const access = await prisma.userToolAccess.findFirst({
        where: { user_id: userId, tool_id: tool.id }
    });

    if (!access) {
       res.status(403).json({ error: 'Assinatura negada. O usuário não possui link com a ferramenta provida.' });
       return;
    }

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        tool_id: tool.id,
        event_type: action,
        user_agent: 'TOOL_EXT_' + toolSlug, // internal footprint
        ip_address: req.ip || ''
      }
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Tracking err:', err);
    res.status(500).json({ error: 'Falha durante o rastreio' });
  }
};
