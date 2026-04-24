import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const grantAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, toolId, toolRoleId } = req.body;

    const access = await prisma.userToolAccess.upsert({
      where: { user_id_tool_id: { user_id: userId, tool_id: toolId } },
      update: { tool_role_id: toolRoleId },
      create: { user_id: userId, tool_id: toolId, tool_role_id: toolRoleId }
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.sub,
        event_type: 'ACCESS_GRANTED',
        tool_id: toolId,
        ip_address: req.ip || req.socket.remoteAddress || '',
        user_agent: req.headers['user-agent'] || '',
      }
    }).catch(console.error);

    res.status(200).json(access);
  } catch (error) {
    console.error('Grant acc err:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const revokeAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, toolId } = req.body;

    await prisma.userToolAccess.delete({
      where: { user_id_tool_id: { user_id: userId, tool_id: toolId } }
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.sub,
        event_type: 'ACCESS_REVOKED',
        tool_id: toolId,
        ip_address: req.ip || req.socket.remoteAddress || '',
        user_agent: req.headers['user-agent'] || '',
      }
    }).catch(console.error);

    res.status(200).json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
       res.status(404).json({ error: 'Vínculo não encontrado' });
       return;
    }
    console.error('Revoke access err:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const getUserAccesses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const accesses = await prisma.userToolAccess.findMany({
      where: { user_id: userId },
      include: {
        tool: { select: { name: true, category: true, slug: true, status: true } },
        toolRole: true
      }
    });

    res.status(200).json(accesses);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const getToolUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { toolId } = req.params;

    const accesses = await prisma.userToolAccess.findMany({
      where: { tool_id: toolId },
      include: {
        user: { select: { id: true, name: true, email: true, status: true, portal_role: true } },
        toolRole: true
      }
    });

    res.status(200).json(accesses);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const bulkGrantAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds, toolId, toolRoleId } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: 'A matriz userIds não pode ser vázia' });
      return;
    }

    const payload = userIds.map(uid => ({
        user_id: uid, 
        tool_id: toolId, 
        tool_role_id: toolRoleId 
    }));

    // Insert ignoring duplicates where applies or skip. 
    // Prisma createMany ignores duplicates with skipDuplicates
    await prisma.userToolAccess.createMany({
      data: payload,
      skipDuplicates: true
    });

    res.status(201).json({ success: true, count: userIds.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const listRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const [portalRoles, toolRoles] = await Promise.all([
      prisma.portalRole.findMany(),
      prisma.toolRole.findMany()
    ]);
    res.status(200).json({ portalRoles, toolRoles });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar perfis' });
  }
};
