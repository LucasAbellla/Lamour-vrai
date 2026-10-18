// Confere a versão publicada: npm run verify:deploy -- https://seu-endereco.pages.dev
const target = process.argv[2];
if (!target) {
  console.error("Informe o endereço publicado: npm run verify:deploy -- https://seu-endereco.pages.dev");
  process.exit(1);
}

const base = new URL(target);
const results = [];
const check = (ok, label, detail = "") => results.push({ ok: Boolean(ok), label, detail });

async function get(path, options = {}) {
  return fetch(new URL(path, base), { redirect: "follow", ...options });
}

check(base.protocol === "https:", "Endereço usa HTTPS", base.href);

const page = await get("./");
const headers = page.headers;
const csp = headers.get("content-security-policy") || "";
check(page.ok, "Página principal responde", `HTTP ${page.status}`);
check(/connect-src[^;]*https:\/\/\*\.supabase\.co/.test(csp), "CSP permite somente o próprio site e o Supabase");
check(/frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp), "CSP bloqueia iframes e plugins");
const hsts = Number(/max-age=(\d+)/.exec(headers.get("strict-transport-security") || "")?.[1] || 0);
check(hsts >= 31536000, "HSTS ativo por pelo menos um ano", headers.get("strict-transport-security") || "ausente");
check(headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
check(headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
check(headers.get("referrer-policy") === "no-referrer", "Referrer-Policy: no-referrer");
check(/camera=\(\)/.test(headers.get("permissions-policy") || ""), "Permissions-Policy desliga câmera, microfone e localização");
check(!/immutable/.test(headers.get("cache-control") || ""), "Página principal não fica presa em cache", headers.get("cache-control") || "sem Cache-Control");

const html = await page.text();
const script = /src="\.?\/?(assets\/[^"]+\.js)"/.exec(html)?.[1];
check(script, "Página carrega o pacote do aplicativo", script || "não encontrado");
if (script) {
  const bundleResponse = await get(script);
  const bundle = await bundleResponse.text();
  const cache = bundleResponse.headers.get("cache-control") || "";
  check(/immutable/.test(cache) && !/no-store/.test(cache), "Arquivos com hash ficam em cache longo", cache || "sem Cache-Control");
  check(/https:\/\/[a-z0-9-]+\.supabase\.co/.test(bundle), "Build de produção aponta para o Supabase");
  // O próprio código menciona "service_role" para recusá-la; procuramos chaves de verdade.
  const adminJwt = (bundle.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g) || []).some(token => {
    try {
      return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role === "service_role";
    } catch (_) {
      return false;
    }
  });
  check(!adminJwt && !/sb_secret_[\w-]{10,}/.test(bundle), "Nenhuma chave administrativa no pacote");
}

const manifestResponse = await get("manifest.webmanifest");
const manifest = manifestResponse.ok ? await manifestResponse.json().catch(() => null) : null;
check(manifest?.display === "standalone" && manifest.icons?.some(icon => icon.sizes === "512x512"), "Manifest pronto para instalação");
const sw = await get("sw.js");
check(sw.ok && /no-cache/.test(sw.headers.get("cache-control") || ""), "Service worker publicado e sempre revalidado", sw.headers.get("cache-control") || `HTTP ${sw.status}`);

if (base.protocol === "https:") {
  const insecure = new URL(base.href);
  insecure.protocol = "http:";
  const redirect = await fetch(insecure, { redirect: "manual" }).catch(() => null);
  const location = redirect?.headers.get("location") || "";
  check(redirect && redirect.status >= 300 && redirect.status < 400 && location.startsWith("https://"), "HTTP redireciona para HTTPS", redirect ? `HTTP ${redirect.status} ${location}` : "sem resposta");
}

for (const { ok, label, detail } of results) console.log(`${ok ? "✓" : "✗"} ${label}${detail && !ok ? ` — ${detail}` : ""}`);
const failures = results.filter(result => !result.ok).length;
console.log(failures ? `\n${failures} item(ns) precisam de atenção.` : "\nPublicação conferida: tudo certo.");
process.exit(failures ? 1 : 0);
