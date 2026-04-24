import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seeding do ToolCenter...');

  // 1. Roles do Portal (Nível 1)
  const portalRoles = ['ADMINISTRADOR', 'OPERADOR', 'VISUALIZADOR'];
  for (const roleName of portalRoles) {
    await prisma.portalRole.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  console.log('✅ Roles do portal criadas.');

  // 2. Roles de Ferramentas (Nível 2)
  const toolRoleAdmin = await prisma.toolRole.upsert({
    where: { name: 'ADMINISTRADOR' },
    update: {},
    create: { name: 'ADMINISTRADOR' },
  });

  const toolRoleOp = await prisma.toolRole.upsert({
    where: { name: 'OPERADOR' },
    update: {},
    create: { name: 'OPERADOR' },
  });

  const toolRoleView = await prisma.toolRole.upsert({
    where: { name: 'VISUALIZADOR' },
    update: {},
    create: { name: 'VISUALIZADOR' },
  });
  console.log('✅ Roles de ferramentas criadas.');

  // 3. Ferramentas (Tools)
  const tool1 = await prisma.tool.upsert({
    where: { slug: 'gerador-recibos' },
    update: {},
    create: {
      name: 'Gerador de Recibos',
      slug: 'gerador-recibos',
      url: 'https://recibos.toolcenter.internal',
      category: 'Financeiro',
      status: 'ACTIVE',
      icon: 'FaReceipt'
    },
  });

  const tool2 = await prisma.tool.upsert({
    where: { slug: 'receitas-web' },
    update: {},
    create: {
      name: 'Receitas Web',
      slug: 'receitas-web',
      url: 'https://receitas.toolcenter.internal',
      category: 'Culinária',
      status: 'ACTIVE',
      icon: 'FaUtensils'
    },
  });
  console.log('✅ Ferramentas criadas.');

  // 4. Usuários de Teste
  const salt = await bcrypt.genSalt(12);
  const hashedPass = await bcrypt.hash('1234', salt);

  // Ana Admin
  const ana = await prisma.user.upsert({
    where: { email: 'ana@toolcenter.com' },
    update: {},
    create: {
      name: 'Ana Admin',
      email: 'ana@toolcenter.com',
      password_hash: hashedPass,
      status: 'ACTIVE',
      must_change_password: true,
      portal_role: { connect: { name: 'ADMINISTRADOR' } },
    },
  });
  console.log('👤 Criado usuário: ana@toolcenter.com / senha: 1234');

  // Beto Operador
  const beto = await prisma.user.upsert({
    where: { email: 'beto@toolcenter.com' },
    update: {},
    create: {
      name: 'Beto Operador',
      email: 'beto@toolcenter.com',
      password_hash: hashedPass,
      status: 'ACTIVE',
      must_change_password: true,
      portal_role: { connect: { name: 'OPERADOR' } },
    },
  });
  console.log('👤 Criado usuário: beto@toolcenter.com / senha: 1234');

  // 5. Vínculos de Acesso (UserToolAccess)
  
  // Ana Admin -> Recibos (Admin), Receitas (Operator)
  await prisma.userToolAccess.upsert({
    where: { 
        user_id_tool_id: { user_id: ana.id, tool_id: tool1.id } 
    },
    update: { tool_role_id: toolRoleAdmin.id },
    create: {
      user_id: ana.id,
      tool_id: tool1.id,
      tool_role_id: toolRoleAdmin.id,
    },
  });

  await prisma.userToolAccess.upsert({
    where: { 
        user_id_tool_id: { user_id: ana.id, tool_id: tool2.id } 
    },
    update: { tool_role_id: toolRoleOp.id },
    create: {
      user_id: ana.id,
      tool_id: tool2.id,
      tool_role_id: toolRoleOp.id,
    },
  });

  // Beto Operador -> Receitas (Admin), Recibos (Viewer)
  await prisma.userToolAccess.upsert({
    where: { 
        user_id_tool_id: { user_id: beto.id, tool_id: tool2.id } 
    },
    update: { tool_role_id: toolRoleAdmin.id },
    create: {
      user_id: beto.id,
      tool_id: tool2.id,
      tool_role_id: toolRoleAdmin.id,
    },
  });

  await prisma.userToolAccess.upsert({
    where: { 
        user_id_tool_id: { user_id: beto.id, tool_id: tool1.id } 
    },
    update: { tool_role_id: toolRoleView.id },
    create: {
      user_id: beto.id,
      tool_id: tool1.id,
      tool_role_id: toolRoleView.id,
    },
  });

  console.log('🚀 Seeding concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
