import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { portal_role_id, search } = req.query;

    const where: any = {};
    if (portal_role_id) where.portal_role_id = portal_role_id as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          portal_role: true,
          _count: {
            select: { userToolAccesses: true }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const getUserContext = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        portal_role: true,
        userToolAccesses: {
          include: {
            tool: true,
            toolRole: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, portal_role_id } = req.body;
    
    const password_hash = await bcrypt.hash('1234', 12);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        must_change_password: true,
        portal_role_id
      }
    });

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'E-mail já está em uso' });
      return;
    }
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, status, portal_role_id } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { name, email, status, portal_role_id }
    });

    res.status(200).json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const password_hash = await bcrypt.hash('1234', 12);

    await prisma.user.update({
      where: { id },
      data: {
        password_hash,
        must_change_password: true
      }
    });

    res.status(200).json({ success: true, message: 'Senha resetada para o padrão' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' }
    });

    res.status(200).json({ success: true, message: 'Usuário desativado' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};
