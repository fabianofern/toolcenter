import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../../infra/database/prisma';
import { signToken, getPublicKey } from '../services/token.service';
import { addToBlacklist } from '../services/blacklist.service';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
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
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(401).json({ error: 'Usuário Inativo' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    if (user.must_change_password) {
      res.status(403).json({
        code: 'MUST_CHANGE_PASSWORD',
        userId: user.id,
        message: 'Você deve alterar sua senha no primeiro acesso.'
      });
      return;
    }

    const tools_access = user.userToolAccesses.map(access => ({
      tool_id: access.tool.id,
      tool_slug: access.tool.slug,
      tool_role: access.toolRole.name
    }));

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (8 * 60 * 60); // 8 hours
    const jti = crypto.randomUUID();

    const payload = {
      iss: 'toolcenter-iam-server',
      aud: 'toolcenter-tools',
      sub: user.id,
      email: user.email,
      name: user.name,
      portal_role: user.portal_role.name,
      tools_access,
      iat,
      exp,
      jti
    };

    const token = signToken(payload);

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        portal_role: user.portal_role.name
      },
      exp
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.jwt;
    if (token && req.user?.jti && req.user?.exp) {
      await addToBlacklist(req.user.jti, req.user.exp);
    }
    
    res.cookie('jwt', '', { maxAge: 0 });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const userPayload = req.user;
    
    if (!userPayload || !userPayload.sub) {
      res.status(401).json({ error: 'Token inválido para refresh' });
      return;
    }

    const { jti, iat, exp, ...restPayload } = userPayload;

    const newIat = Math.floor(Date.now() / 1000);
    const newExp = newIat + (8 * 60 * 60);
    const newJti = crypto.randomUUID();

    const newPayload = {
      ...restPayload,
      iss: 'toolcenter-iam-server',
      aud: 'toolcenter-tools',
      iat: newIat,
      exp: newExp,
      jti: newJti
    };

    const newToken = signToken(newPayload);

    await addToBlacklist(jti, exp);

    res.cookie('jwt', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(200).json({ success: true, exp: newExp });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const forcePasswordChange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { portal_role: true, userToolAccesses: { include: { tool: true, toolRole: true } } } });

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    // Default password as per instructions ('1234' or system default, we validate using bcrypt)
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(401).json({ error: 'Usuário Inativo' });
      return;
    }

    // Regras de complexidade e check de senhas ruins
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passRegex.test(newPassword)) {
      res.status(400).json({ error: 'A nova senha deve ter no mínimo 12 caracteres, incluindo uma letra maiúscula, uma minúscula, um número e um caractere especial.' });
      return;
    }

    const commonPasswords = ['1234567890!aA', 'Password123!', 'Admin@123456', 'QWERTYuiop!1', 'Mudar@123456'];
    if (commonPasswords.includes(newPassword) || newPassword.toLowerCase().includes('password') || newPassword.toLowerCase().includes('senha')) {
      res.status(400).json({ error: 'A senha escolhida é muito comum ou fraca. Escolha outra.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_change_password: false
      }
    });

    // Auto login
    const tools_access = user.userToolAccesses.map(access => ({
      tool_id: access.tool.id,
      tool_slug: access.tool.slug,
      tool_role: access.toolRole.name
    }));

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (8 * 60 * 60);
    const jti = crypto.randomUUID();

    const payload = {
      iss: 'toolcenter-iam-server',
      aud: 'toolcenter-tools',
      sub: user.id,
      email: user.email,
      name: user.name,
      portal_role: user.portal_role.name,
      tools_access,
      iat, exp, jti
    };

    const token = signToken(payload);

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(200).json({ success: true, redirectTo: '/dashboard' });
  } catch (error) {
    console.error('Force password change error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const jwks = (req: Request, res: Response): void => {
  const pubKeyString = getPublicKey();
  
  try {
    const pubKeyObj = crypto.createPublicKey(pubKeyString);
    const jwk = pubKeyObj.export({ format: 'jwk' });

    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      keys: [
        {
          kty: 'RSA',
          kid: 'toolcenter-key-id-2024',
          use: 'sig',
          alg: 'RS256',
          n: jwk.n,
          e: jwk.e
        }
      ]
    });
  } catch (error) {
    console.error('JWKS error:', error);
    res.status(500).json({ error: 'Erro gerando JWKS' });
  }
};
