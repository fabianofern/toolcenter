# Guia de Fluxos de Autenticação e Acesso - ToolCenter IAM

Este documento descreve detalhadamente a dinâmica de Autenticação (SSO via JWT) do **ToolCenter**, guiando desenvolvedores na implementação segura da integração entre o Portal Central e as Ferramentas Satélites Heterogêneas.

---

## 1. Fluxo Passo a Passo (End-to-End)

O ciclo de vida do acesso, do Login ao Logout.

### 1.1 Processo de Login
1. O usuário acessa `https://auth.toolcenter.internal`.
2. Insere **E-mail e Senha**. O SPA envia via POST `/api/auth/login`.
3. O Backend Node.js verifica as credenciais no PostgreSQL.
4. **Validação de Força Maior:** O backend checa a flag `must_change_password`. Se for o primeiro acesso (ex: senha "1234"), ele interrompe o fluxo de sucesso, retorna um `403 Forbidden` com payload `{"code": "MUST_CHANGE_PASSWORD"}`, redirecionando o frontend para a tela apropriada.
5. Sendo credenciais válidas e não precisando resetar, o Backend gera o **JWT Global RS256**.
6. O token é inserido em um **Cookie HttpOnly, Secure, SameSite=Strict**.
7. O usuário é redirecionado para o Dashboard Principal do Portal.

### 1.2 Acesso ao Portal (Dashboard)
1. O Frontend React/Angular faz um GET `/api/me`. O navegador envia o Cookie automaticamente.
2. O Backend extrai o usuário do JWT e suas permissões e retorna o Payload decodificado como JSON para o Frontend.
3. O Frontend renderiza:
   - Se for o **Beto** (`portal_role: "OPERADOR"`): Exibe a Saudação, o Dashboard sem o menu "Administração" na sidebar, monta os cards das ferramentas "Receitas Web" e "Gerador de Recibos". Oculta o ícone de engrenagem nestes cards.
   - Se for a **Ana** (`portal_role: "ADMINISTRADOR"`): Renderiza o menu "Administração" na Sidebar, habilita o ícone de engrenagem (Configuração Global) em TODOS os cards das ferramentas que aparecem para ela. Só aparecem as ferramentas onde ela possui vínculo explícito (Nível 2).

### 1.3 Acesso a uma Ferramenta e Validação
1. O usuário clica no Botão "Acessar" de um Card.
2. O frontend executa a **Estratégia de Redirecionamento Seguro** (descrita na seção 4).
3. A requisição bate na ferramenta satélite (`https://receitas.toolcenter.internal`).
4. O Backend da ferramenta lê o subdomínio/body e obtém o Token.
5. Valida a Assinatura RS256 contra a chave pública (`/jwks.json` do Servidor Auth).
6. Lê a claim `sub` e as permissões de `tools_access`.
7. O Beto entra no Receitas Web e seu Auth Local entende: `role local: ADMINISTRADOR`. Libera o CRUD de receitas para ele.

### 1.4 Logout e Invalidação
1. O usuário clica em "Sair" no Header.
2. O Frontend envia um `POST /api/auth/logout`.
3. O Servidor Extrai o `jti` do token atual, calcula o tempo de vida restante (`exp` - NOW) e o assinala na **Blacklist** (Redis) com TTL igual ao tempo restante.
4. O Servidor destrói o cookie setando `Max-Age=0`.
5. Se o Beto tinha a aba do "Receitas Web" aberta e tenta navegar, a ferramenta satélite verifica se o `jti` está na Blacklist. Estando, a ferramenta descarta a sessão local e redireciona (401) o Beto para a tela de Login do portal.

---

## 2. Exemplo Completo de Payload JWT (Cenário: Beto)

```json
// HEADER (Decodificado)
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "toolcenter-key-id-2024" // Identificador da Chave para rotação s/ downtime
}

// PAYLOAD (Decodificado)
{
  "iss": "https://auth.toolcenter.internal",
  "sub": "a1b2c3d4-b3t0-1234-abcd-00000000000b",
  "name": "Beto Silva",
  "email": "beto@empresa.com.br",
  "portal_role": "OPERADOR", // Nível 1: Não tem acesso a telas ADM do portal
  "tools_access": [
    // Ferramenta 1: Nível 2 - Ele é Administrator Local deste domínio
    {
      "tool_id": "8f9e2b1c-c2a4-4e78-9e6b",
      "tool_slug": "receitas-web",
      "tool_role": "ADMINISTRADOR" 
    },
    // Ferramenta 2: Nível 2 - Ele é apenas Visitante Local deste domínio
    {
      "tool_id": "c71a3e8b-9d4f-4a1c-8b2f",
      "tool_slug": "gerador-recibos",
      "tool_role": "CONSULTA"
    }
  ],
  "iat": 1712750400,
  "exp": 1712779200, 
  "jti": "jwt-unico-beto-83j2-91k4"
}
```

*Análise:* Quando o Beto clica em "Receitas Web", a aplicação em PHP desta ferramenta lerá o array `tools_access`, filtrará pelo seu slug `receitas-web`, encontrará o "ADMINISTRADOR" e dará direitos máximos APENAS nesta aplicação.

---

## 3. Diagrama de Sequência Descrito

**Atores:** Usuário (Browser), ToolCenter Frontend (SPA), IAM Server (Node), Tool Satélite (PHP/Python).

1. **Browser** -> POST `/login` -> **SPA**
2. **SPA** -> POST `/api/v1/auth` -> **IAM Server**
3. **IAM Server** verifica DB, Gera JWT RS256.
4. **IAM Server** -> Retorna `200 OK` + `Set-Cookie: jwt=ey...; HttpOnly; SameSite=Strict` -> **SPA**
5. **Browser** (Usuário clica em Acessar Ferramenta) -> Ocorre Redirect Seguro -> **Tool Satélite**
6. **Tool Satélite** recebe o Request e abstrai o Cookie JWT.
7. **Tool Satélite** -> (Sem Chave Publica em cache?) Faz `GET /jwks.json` -> **IAM Server**
8. **IAM Server** -> Retorna JWKS Keys -> **Tool Satélite** (Guarda em cache).
9. **Tool Satélite** Verifica assinatura RS256, Expiração e Perfil Local em `tools_access`. Aplica o acesso. Retorna Screen HTML.
10. **Background Polling:** Tool Satélite -> `POST /api/check-blacklist {jti}` -> IAM Server (Checa Blacklist a cada refresh/page switch do usuário na ferramenta).

---

## 4. Estratégia de Redirecionamento Seguro

Ao transitar do Portal (onde o JWT foi emitido) para uma Ferramenta (ex: Receitas Web em PHP), como passar a credencial?

- **A) Redirect GET via Query** (`?token=xyz`): ❌ **NÃO RECOMENDADO**. Tokens vazam em Histórico de Navegação e Logs de Servidores e Proxies.
- **B) Redirect Automático POST** (Form Hidden POST): ⚠️ **MEIO-TERMO**. O Backend satélite lê o `$_POST['token']` e inicia a sessão. Mais seguro, porém prejudica UX (requer recarga forte) e quebra deep links diretos (`/receitas/ver/1`).
- **C) Cookie Compartilhado (Domínio Pai):** ✅ **RECOMENDADO / PADRÃO OURO**.
  - O Portal IAM emite o cookie HttpOnly setado para `.toolcenter.internal`.
  - O portal rola em `hub.toolcenter.internal`.
  - A ferramenta rola em `receitas.toolcenter.internal`.
  - O navegador cuidará sozinho de anexar o cookie para a ferramenta satélite na transição de link normal `<a>`. Profondamente seguro contra interceptações e transparente.
- **D) Token Exchange (OIDC Flow):** 🏆 **MÁXIMA SEGURANÇA (Para Domínios Diferentes)**. Em caso de incapacidade de usar subdomínios, o Portal passa um Authorization Code temporário e de uso único (1 minuto) via Query String, e o backend da ferramenta troca esse Code pelo JWT diretamente contra a API Mestra Server-to-Server, gerando um Cookie Local independente.

**Decisão do ToolCenter:** Assumindo que rodam no mesmo ambiente de rede da empresa, utilizar a opção **C (Cookie Compartilhado Subdomínio)**. É limpo, e abraça as Ferramentas Heterogêneas sem exigir redesenho de infra.

---

## 5. Implementação Conceitual (Heterogênea) de Validação JWT

A responsabilidade das Ferramentas é leve: **Apenas Verificar, Nunca Emitir.**

### Em PHP (Ex: Symfony / Laravel ou Script raw)
A ferramenta recebe o request, obtém o cookie `$_COOKIE['jwt']`.
Usa uma lib como `firebase/php-jwt`:
1. Faz cache (Memcached/Redis) da chave pública RSA via chamada curl no `/.well-known/jwks.json`.
2. Chama `JWT::decode($jwt, $publicKey)`.
3. Erro de Assinatura/Expira? Lança 401 e desvia pra tela do HubAuth.
4. Sucesso? Mapeia o Payload e popula a global `$_SESSION['user'] = $payload`.

### Em Python (Ex: FastAPI / Django)
Recebe a requisição, usa o pacote abstrato dependente ou a lib base `PyJWT` e `jwks_rsa`:
1. Instancia `PyJWKClient("http://auth/jwks.json")`.
2. Lê a header JWT, pega o `k_id` e extrai a respectiva pubkey do Client.
3. Faz `jwt.decode(token, pk, algorithms=["RS256"])`.
4. Injeta as role do dict `tools_access[my_slug]` nos decorators de Rota `@require_role("ADMINISTRADOR")`.

### Em Node.js (Ex: Express)
Com uso das middlewares padrões do ecossistema: `express-jwt` aliado à biblioteca auxiliar `jwks-rsa`:
Essas libs abstraem o fetch da PubKey automaticamente com política de cache de memoria configurável. Express popula `req.user` resolvendo a claim, pronto para middlewares de checagem.

---

## 6. Estratégia do Alerta e Popup de Renovação (15 min para Exp)

Garantir que usuários engajados não percam dados preenchidos devido a um "Timeout Silencioso".

1. **Iframe Invisível / Pós-Message (Centralização Única):**
   - Como temos Múltiplas Aplicações trabalhando visualmente, carregar um logic javascript em cada uma é repetitivo.
   - O ToolCenter fornece um Header Global (Importável via Script Tags de 1Kb nas tools, ou injetado via proxy) que instancia um Web Worker para checar o tempo do cookie (lendo a propriedade exp, se não isolada por HttpOnly payload split, ou recebendo o payload no start da aplicação via `/whoami`).
2. Quando faltam **15 minutos (`exp - 900s`)**, esse Worker lança evento no DOM Global e renderiza um Modal Z-Index Infinito.
3. "Sua sessão expira. Deseja Renovar?"
4. No Clique: Requisição **Ajax** vai pro IAM Server route `/auth/refresh` enviando o antigo JWT expirando.
5. IAM emite e **sobrescreve o Set-Cookie** estendendo por mais 8 horas. Como as interações das tools leem do Cookie em cada nova transação, tudo se atualiza nos bastidores suavemente sem o usuário perceber a troca de string JWT.

---

## 7. Estrutura da Blacklist e Logout Instantâneo

O problema da JWT é a "Natureza Stateless": ele é válido até vencer, mesmo se o usuário deletar o cookie na UI dele (se um atacante capturou a string). A Blacklist garante que ao invocar `/logout`, esse JWT específico de fato "queime" globalmente.

- **Stack Escolhida:** `Redis` (Obrigatório em cenários distribuídos de altíssima concorrência para check de string simples).
- **Modelo no Redis:**
  - `KEY`: `blacklist:jti:{token_uuid}` (Ex: `blacklist:jti:d9b2d-11x`)
  - `VALUE`: `true`
  - `TTL` (Command EXPIRE do redis): Configurado dinamicamente para o exato delta entre o Now() e a expiração do Token decodificado. Se faltavam 2 horas do turno pra expiração padrão, o Redis guarda o UUID por 2 horas, e depois destrói naturalmente economizando RAM infinita.
- Na porta de entrada de **cada** Ferramenta Satélite, além da verificação CPU JWT RS256, invoca-se silenciosamente (via Gateway Kong ou sidecar middleware) uma leitura rápida nesse cluster redis para saber se esse UUID JWT não existe na base "suja" antes de deixar o usuário trabalhar.

---

## 8. Checklist de Segurança OWASP do Fluxo

- [x] **XSS Mitigado:** O token não reside no `localStorage` do SPA, impedindo um read simples por Payload injeção javascript externo.
- [x] **CSRF Bloqueado:** Proteção forte pela aplicação da propriedade cookie `SameSite=Strict` combinada a `HttpOnly` se garantindo de navegoção intra-empresa direta sem postbacks mascarados.
- [x] **Clickjacking Blindado:** Responders de Login forçam Cabeçalhos HTTP `X-Frame-Options: DENY` e `Content-Security-Policy: frame-ancestors 'none'`.
- [x] **Falsificação de Chave (None Algorithm):** Bibliotecas Node/PHP e Python em satélites programadas para forçar EXCLUSIVAMENTE Validação no Arg `['RS256']`, blindando contra o clássico bypass do algoritmo de Token Vazio "none".
- [x] **Privilégio Mínimo (Principle of Least Privilege):** A autorização baseada em Claims `tools_access[]` impede que o usuário force URLs de ferramentas ou "Adivinhe rotas" (Insecure Direct Object Reference) da qual não pertence sem a anuência em banco gravada na emissão.
