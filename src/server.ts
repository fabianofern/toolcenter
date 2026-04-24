import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 3000;

const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log(`[AUTH-SERVER] 🚀 Gateway do ToolCenter IAM rodando na porta ${PORT}`);
      console.log(`[AUTH-SERVER] 🔰 Ambiente: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('[AUTH-SERVER] Erro fatal:', error);
    process.exit(1);
  }
};

startServer();
