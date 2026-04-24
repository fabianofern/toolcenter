import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const createTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, slug, url, icon, category, status } = req.body;

    const newTool = await prisma.tool.create({
      data: { name, slug, url, icon, category, status }
    });

    // Auditoria (assumindo que o req.user existe pelo validateJwtCookie)
    await prisma.auditLog.create({
      data: {
        user_id: req.user?.sub,
        event_type: 'TOOL_CREATED',
        tool_id: newTool.id,
        ip_address: req.ip || req.socket.remoteAddress || '',
        user_agent: req.headers['user-agent'] || '',
      }
    }).catch(err => console.error('Erro de audit', err));

    res.status(201).json(newTool);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Slug já existe' });
      return;
    }
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const listTools = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { status, category, search } = req.query;

    const where: Prisma.ToolWhereInput = {};
    if (status) where.status = status as any;
    if (category) where.category = category as string;
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const [tools, total] = await Promise.all([
      prisma.tool.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: { select: { userToolAccesses: true } }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.tool.count({ where })
    ]);

    res.status(200).json({
      data: tools,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List tools error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const getToolById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tool = await prisma.tool.findUnique({
      where: { id },
      include: {
        userToolAccesses: {
          include: {
            user: { select: { name: true, email: true, status: true } },
            toolRole: true
          }
        }
      }
    });

    if (!tool) {
      res.status(404).json({ error: 'Ferramenta não encontrada' });
      return;
    }

    res.status(200).json(tool);
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const updateTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, url, icon, category, status } = req.body;

    const tool = await prisma.tool.update({
      where: { id },
      data: { name, url, icon, category, status }
    });

    res.status(200).json(tool);
  } catch (error: any) {
    if (error.code === 'P2025') {
       res.status(404).json({ error: 'Ferramenta não encontrada' });
       return;
    }
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const updateToolStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const tool = await prisma.tool.update({
      where: { id },
      data: { status }
    });

    res.status(200).json(tool);
  } catch (error) {
    console.error('Update tool status err:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const deleteTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const toolAccess = await prisma.userToolAccess.findFirst({ where: { tool_id: id } });
    if (toolAccess) {
       res.status(400).json({ error: 'Ferramenta possui dependentes, use desativação (INACTIVE) em vez de soft delete hard delete.' });
       return; // Requirements say "Ou soft delete permanently". We'll just update to INACTIVE if it has users. To match exactly:
    }

    await prisma.tool.update({
      where: { id },
      data: { status: 'INACTIVE' }
    });

    res.status(200).json({ success: true, message: 'Ferramenta inativada com sucesso' });
  } catch (error) {
    console.error('Del tool err:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const uploadToolIcon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const iconUrl = `/api/tools/${id}/serve-icon`;
    
    // We store the raw filename in the DB as well as icon url? The DB has 'icon' string.
    // So we'll combine it. Or actually, just store the filename and the frontend constructs URL?
    // Let's store filename only so we can fetch it.
    const iconFilename = req.file.filename;

    const tool = await prisma.tool.update({
      where: { id },
      data: { icon: iconFilename }
    });

    res.status(200).json({ success: true, iconUrl: `/api/tools/${id}/serve-icon`, tool });
  } catch (error: any) {
    if (error.code === 'P2025') {
       res.status(404).json({ error: 'Ferramenta não encontrada' });
       return;
    }
    console.error('Upload icon err:', error);
    res.status(500).json({ error: 'Erro interno no upload' });
  }
};

import path from 'path';

export const serveToolIcon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tool = await prisma.tool.findUnique({ where: { id: id } });
    if (!tool || !tool.icon) {
      res.status(404).json({ error: 'Ícone não encontrado' });
      return;
    }
    
    const iconPath = path.join(__dirname, '../../../../storage/uploads/icons', tool.icon);
    res.sendFile(iconPath);
  } catch (error) {
    console.error('Serve icon err:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};
