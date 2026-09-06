// CORS compartilhado entre as Edge Functions do Painel CFO.
//
// Antes, cada function liberava "Access-Control-Allow-Origin: *" (qualquer
// site podia chamar). Isso não permite roubo de sessão (o token do Supabase
// fica em localStorage, que não é acessível entre origens diferentes), mas
// é mais permissivo do que precisa — restringimos à origem real do app.
//
// Inclui localhost:8080 (porta padrão do Vite neste projeto, ver
// vite.config.ts) pra não quebrar testes locais dessas functions durante
// desenvolvimento.
const ALLOWED_ORIGINS = new Set([
  "https://painel-cfo-apmcv.vercel.app",
  "http://localhost:8080",
]);

const ORIGEM_PADRAO = "https://painel-cfo-apmcv.vercel.app";

/**
 * Monta os headers de CORS pra uma requisição específica — ecoa a origem
 * de quem chamou só se ela estiver na lista permitida, senão cai pra
 * origem padrão (produção). "Vary: Origin" avisa caches/proxies que a
 * resposta varia conforme a origem da requisição.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : ORIGEM_PADRAO;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
