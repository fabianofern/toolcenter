import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis from './infra/cache/redis';

// Import do controller para o JWKS
import { jwks } from './modules/auth/controllers/auth.controller';

// BigInt Serialization for Prisma
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import toolRoutes from './modules/tools/routes';
import accessRoutes from './modules/access/routes';
import auditRoutes from './modules/tracking/routes';
import { validateJwtCookie } from './common/middlewares/validateJwtCookie';
import { requirePortalRole } from './common/middlewares/requirePortalRole';
import { csrfTokenMiddleware, generateCsrfToken } from './common/middlewares/csrfToken';
import { globalLimiter } from './common/middlewares/rateLimiter';

const app = express();
const prisma = new PrismaClient();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin as string)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api', globalLimiter);

app.use(express.json());
app.use(cookieParser());

app.get('/api/csrf-token', generateCsrfToken);
app.use('/api', csrfTokenMiddleware);

// NOVO: Endpoint público para as chaves JWKS (essencial para o SSO)
app.get('/.well-known/jwks.json', jwks);

// Protection for admin area
app.use('/admin', validateJwtCookie, requirePortalRole(['ADMINISTRADOR']));

// Static Files - Frontend
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'IAM-Core-Auth' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/me', validateJwtCookie, async (req: Request, res: Response) => {
  try {
    const userRole = req.user.portal_role;
    const tools_access = req.user.tools_access || [];
    const toolIds = tools_access.map((ta: any) => ta.tool_id);

    const activeTools = await prisma.tool.findMany({
      where: {
        id: { in: toolIds },
        status: 'ACTIVE'
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    const isPortalAdmin = userRole === 'ADMINISTRADOR';

    const enrichedTools = activeTools.map(tool => {
      const userToolMap = tools_access.find((ta: any) => ta.tool_id === tool.id);
      return {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        url: tool.url,
        icon: tool.icon,
        category: tool.category,
        tool_role: userToolMap?.tool_role,
        canAccess: true,
        isAdmin: userToolMap?.tool_role === 'ADMINISTRADOR'
      };
    });

    res.status(200).json({
      user: {
        id: req.user.sub,
        name: req.user.name,
        email: req.user.email,
        portal_role: userRole
      },
      dashboard: {
        tools: enrichedTools,
        isPortalAdmin
      }
    });
  } catch (error) {
    console.error('Error on /api/me:', error);
    res.status(500).json({ error: 'Falha gravíssima ao obter contexto' });
  }
});

// Arquivos frontend catch-all corrigido (previne "socket hang up")
app.get('*', (req, res) => {
  // Se for uma rota de API ou arquivo de sistema não encontrado, retorna 404 em vez de travar
  if (req.path.startsWith('/api') || req.path.startsWith('/.')) {
    if (!res.headersSent) {
      res.status(404).json({ error: 'Endpoint não encontrado' });
    }
    return;
  }
  
  // Roteamento SPA: Dashboard ou Login
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (req.path.startsWith('/dashboard')) {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

/**
 * Middleware Global de Tratamento de Erro.
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', { message: err.message, stack: err.stack, ip: req.ip });
  
  res.status(err.status || 500).json({
    error: {
      message: 'Internal Server Error',
    }
  });
});

export default app;
