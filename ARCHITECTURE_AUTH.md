# Arquitetura do Sistema de Controle de Acesso (IAM) - ToolCenter

Este documento apresenta o design arquitetural para a fundação de Autenticação (Auth) e Gestão de Identidade e Acesso (IAM) do portal ToolCenter, dimensionado para suportar até 10k usuários e 50 ferramentas descentralizadas.

---

## 1. Modelo Entidade-Relacionamento (ER) - PostgreSQL

A modelagem de dados foi desenhada visando normalização para integridade e desnormalização estratégica preventiva para performance no momento do login.

### Tabelas, Índices e Constraints

**1. `portal_roles` (Perfis do Portal Nível 1)**
- `id` (PK, UUID)
- `name` (VARCHAR, UNIQUE) -> Valores: 'ADMIN', 'OPERATOR', 'VIEWER'
- `description` (TEXT)

**2. `tool_roles` (Perfis de Ferramenta Nível 2)**
- `id` (PK, UUID)
- `name` (VARCHAR, UNIQUE) -> Valores: 'ADMIN', 'OPERATOR', 'VIEWER'
- `description` (TEXT)

**3. `users` (Usuários Globais)**
- `id` (PK, UUID)
- `name` (VARCHAR(150), NOT NULL)
- `email` (VARCHAR(150), NOT NULL, UNIQUE)
- `password_hash` (VARCHAR(255), NOT NULL)
- `portal_role_id` (FK -> `portal_roles(id)`)
- `status` (ENUM: 'ACTIVE', 'INACTIVE', DEFAULT: 'ACTIVE')
- `must_change_password` (BOOLEAN, DEFAULT: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
*Índices:* `idx_users_email` (B-Tree) para buscas rápidas no login.

**4. `tools` (Cadastro de Ferramentas)**
- `id` (PK, UUID)
- `slug` (VARCHAR(50), NOT NULL, UNIQUE) -> Usado na claim do JWT
- `name` (VARCHAR(100), NOT NULL)
- `url` (VARCHAR(255), NOT NULL)
- `icon` (VARCHAR(50))
- `category` (VARCHAR(50))
- `status` (ENUM: 'ACTIVE', 'INACTIVE', DEFAULT: 'ACTIVE')
- `created_at` (TIMESTAMP)

**5. `user_tool_access` (Vínculo Usuário -> Ferramenta -> Perfil Nível 2)**
- `user_id` (FK -> `users(id)`, ON DELETE CASCADE)
- `tool_id` (FK -> `tools(id)`, ON DELETE CASCADE)
- `tool_role_id` (FK -> `tool_roles(id)`)
- `created_at` (TIMESTAMP)
*Keys:* PK Composta (`user_id`, `tool_id`) para evitar vínculos duplicados.
*Índices:* `idx_user_tool_user_id` para agilizar a montagem do JWT.

**6. `audit_logs` (Auditoria de Eventos)**
- `id` (PK, BIGSERIAL)
- `user_id` (FK -> `users(id)`, NULL se login falhou e id não encontrado)
- `event_type` (VARCHAR(50)) -> 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'TOOL_ACCESS', 'PASSWORD_RESET', 'USER_CREATED'
- `tool_id` (FK -> `tools(id)`, NULL se for evento geral do portal)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `created_at` (TIMESTAMP)
*Índices:* `idx_audit_logs_created_at` (BRIN ou B-Tree) para políticas de retenção (purge > 90 dias) e `idx_audit_logs_user_event`.

**7. `token_blacklist` (Controle de Logout / Revogação)**
- `jti` (VARCHAR(255), PK) -> JWT ID
- `exp` (TIMESTAMP) -> Quando o token expiraria naturalmente
- `created_at` (TIMESTAMP)
*Índices:* O `jti` atua como chave primária e índice. Necessário um Job/Worker para apagar registros onde `exp < NOW()`.

---

## 2. Diagrama Lógico e Relacionamentos

- **Usuário ↔ Perfil do Portal N1 (N:1):** Cada usuário possui apenas 1 Perfil Principal (Administrador, Operador, Consulta), que dita suas capacidades globais no ToolCenter.
- **Usuário ↔ Ferramenta (N:M):** Um usuário pode acessar várias ferramentas.
- **Relacionamento Intermediário (`user_tool_access`):** Materializa a relação (N:M), carregando com ele a "permissão local de nível 2" (`tool_role_id`).
- **Resolução Visual no Frontend Frontend:** 
  - *Menu Administração:* Destravado e exibido **apenas se** `users.portal_role_id` for equivalente a 'ADMIN'.
  - *Botão "Acessar" Ferramenta X:* Exibido para o usuário **apenas se** existe um registro para o seu id e ferramenta no `user_tool_access`.
  - *Ícone Engrenagem (Config global da tool):* Exibido **apenas se** `users.portal_role_id` for 'ADMIN'.

---

## 3. Fluxo de Autenticação Centralizado (Step-by-Step)

1. **Autenticação:** Usuário insere credenciais na tela de login do ToolCenter.
2. **Validação BD:** Auth API busca `email` em `users`, valida `password_hash` (bcrypt/argon2), e confirma se `status == 'ACTIVE'`.
3. **Checagem de Nova Senha:** Se `must_change_password == TRUE` (ex: 1º acesso restado pelo Admin), o fluxo sofre override. A API retorna status 403 / Específico, guiando o SPA para a tela forçada de "Definir Nova Senha" e impedindo a emissão do token global (SSO).
4. **Montagem de Claims:** Cumpridas as aprovações, a API busca a "visão portal N1" e todos os vínculos "ferramentas N2" desse usuário em `user_tool_access`.
5. **Assinatura (SignIn):** API assina o payload do JWT com a Chave Privada RSA.
6. **Delivery:** O Token é entregue ao SPA inserido obrigatoriamente como `Cookie HttpOnly Secure` e com flag `SameSite=Strict`.
7. **Integração com Ferramentas Satélites (Pós Login):**
   - Usuário clica em "Acessar" e navega para `ferramenta-secundaria.intra.com`.
   - Como estão idealmente via subdomínio compartilhado, a ferramenta secundária recebe o Auth Cookie.
   - A Ferramenta consome o JWT, extraindo a assinatura. E consulta o endpoint "Público" `/.well-known/jwks.json` mantido pelo Portal Central (guardando a chave em cache local de 1hr).
   - Valida assinatura, decodifica, confere as Claims, rastreia via Matrix `tools_access[]` qual permissão (tool_role) e aplica a lógica de autorização localmente.
8. **Logout Rápido Global:** Usuário clica Sair no Portal Portal. A API joga o `jti` do token atual na tabela banco `token_blacklist` e destrói o cookie instruindo a expiração. Se ele tentar bater numa ferramenta satélite a mesma consulta o db de Blacklist cruzado e barra. 

---

## 4. Estrutura Proposta do Payload JWT Global (RS256)

```json
{
  "iss": "toolcenter-iam-server",
  "sub": "b5a91ed4-3c58-4503-aad4-282d8c306518",
  "jti": "d9b2d63d-a233-4123-8478-36b71891ce51",
  "name": "Fabiano",
  "email": "fabiano@empresa.com.br",
  "portal_role": "ADMIN",
  "tools_access": [
    {
      "tool_id": "c1f1",
      "tool_slug": "pdf-indexer",
      "tool_role": "OPERATOR"
    },
    {
      "tool_id": "c1f2",
      "tool_slug": "receipt-generator",
      "tool_role": "VIEWER"
    }
  ],
  "iat": 1681140000, 
  "exp": 1681168800  // Timestamp exato do limite + 8h de Turno
}
```

---

## 5. Arquitetura de Pastas do Projeto Backend (TypeScript / Express ou NestJS Style)

Estrutura pensada focada em Domínios Modulares, isolando bem responsabilidades:

```text
src/
├── config/              # Variáveis ambiente, config CORS, infra JWT KEYS config
├── common/
│   ├── middlewares/     # Ex: ValidateJwtCookie, CSRFGuard
│   ├── errors/          # Exception Handlers padronizados da API
│   └── utils/           # Bcrypt Helpers, Logger Utils, Formaters
├── modules/
│   ├── auth/            # (Core) Domínio de IAM Auth
│   │   ├── controllers/ # login, logout, jwks.json, force-password-reset
│   │   └── services/    # auth.service (core validations e emissão jwt), token-blacklist.service
│   ├── users/           # (Core) Domínio CRUD Base Usuário Nível Portal
│   │   ├── controllers/ 
│   │   └── services/    
│   ├── tools/           # Domínio Gestão Metadados das Ferramentas
│   │   ├── controllers/
│   │   └── services/
│   └── tracking/        # Modulo Assíncrono Auditoria Logs (audit_logs db hook)
└── infra/
    ├── database/        # Client PostgreSQL, ORM Models (Ex: Prisma / TypeORM) e Repositories Data
    └── cache/           # Cliente Redis (Blacklist rápida) opcional, caso nao use postgres puro
```

---

## 6. Menu Administração - Estratégia UX (Organização)

Administradores devem ter a experiência "Action Oriented". Eles acessam comumente para "liberar um colaborador", "Zerar a Senha que a pessoa perdeu", e raramente para "cadastrar uma nova tool do dev team."

### A estrutura baseada em Painel Único Dividido em Abas Horizontais (Tabs)
Mover para navegação modular e evitar múltiplos carregamentos de sub-rotas.

1. **Aba: Gestão Principal de Usuários & Vínculos** (Aba Padrão - Mais Acessada)
   - Tabela Master: Nome, E-mail, Portal Role e Status Ativo/Inativo.
   - **Quick Actions (Ações na linha):** Um botão de ícone raio ou chave que diz "Reset Senha Padrão". (Executa a feature 4 de Regra de Negocio rapidame em modal confirmação).
   - **Gerir Vínculos Nível 2:** Ao clicar em editar um Usuário, abre-se um Panel Lateral Dinâmico "Slide-over" (Dialog overlay no canto direito). Contendo Multiselects para as Tools, e dropdown para Roles de ferramentas, mantendo a Tabela visível enquanto trabalha para alta eficácia.

2. **Aba: Registro de Ferramentas** (Uso Eventual)
   - Tabela com Slug e Botões Ligar/Desligar a visibilidade de toda a ToolCenter. Carga para novos metadados da App.

3. **Aba: Security & Auditoria** 
   - Grid de Leitura Fria: Quem acessou onde, log de falhas de senha. Painel crucial para checagens gerenciais ou incidentes via filtro robusto de dia/hora e usuário especifico.

---

## 7. Decisões Técnicas Documentadas (Trade-offs e Exigências)

### Por que JWT RS256 e endpoint de validação (JWKS) ao invés de Simétrico (HS256)?
Temos uma arquitetura de "Satélites", com variadas linguagens como *PHP e Node em máquinas diferentes*. Compartilhar o Segredo (Secret Key HS256) em diversas bases vulnerabiliza todos e causa caos para rotacionar Keys em deploy/patchs de vulnerabilidade. Com `RS256`, apenas a API Auth tem a Chave Privada em posse para MOLDAR permissões e assinaturas. Ela serve uma rota Endpoint pública com a *Chave Pública em JWKS* (JSON Web Key Set). Os satélites simplesmente a leem e comprovam sem precisar conversar via request constante e nem guardar um secret.

### Por que "HttpOnly + SameSite=Strict" na Web?
Deixar Single Page Applications (Next/Vite/React) lidar com Strings Tokens no browser memory (localStorage) via scripts é alvo fácil primário do vetor ataque "XSS - Cross Site Scripting". Com a Flag `HttpOnly` Set-Cookies via cabeçalho do Node no momento do Response do /login auth, os navegadores isolam o cookie do JS local e anexam transparente na Header cada vez que vão se mover cross-pages de sub-domínios ToolCenter de forma segura, combinada ao `SameSite` para extinguir CSRF falsification origin origin tracking e Clickjacking iframes da vida. Extensamente robusto para uso corpotativo.

### Redis Opcional Vs Postgres Blacklist Single Logout?
Um JWT assinado tem "vida própria e contínua" no corpo dele de 8h sem validar DB. Como matar caso um administrador baniu do RH as 11:00 am ou no logout do button do UI? Forçando sempre as rotas lerem de uma CheckDB ou CheckRedis para Tokens Queimados (`blacklist`). O ideal para grandes fluxos como 10k players, a tabela Postgres resolve se houver bons índices `exp` ou index B-tree unicos `jti`, entretanto introduzir Redis eleva essa eficiência de leitura constante das rotas pra mili-segundos (o famoso API Gateway validation behavior de tokens de single point of cache).
