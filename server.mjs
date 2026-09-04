import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(rootDir, 'dist');
const PORT = Number(process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/**
 * Caminho absoluto de um pathname de request, ou `null` se ele escapa do dist.
 *
 * Medido: o parser de `new URL` já remove segmentos `..`, inclusive na forma
 * percent-encoded (`/%2e%2e/x` chega aqui como `/x`). Ou seja, um request HTTP
 * normal não consegue trazer travessia até esta função.
 *
 * A contenção existe como defesa em profundidade: ela vale para quem chamar a
 * função direto e para um refactor futuro que leia `req.url` sem passar por
 * `new URL`. `server.test.mjs` exercita exatamente esses caminhos, e mutar a
 * comparação abaixo derruba 3 testes.
 *
 * @param {string} distDir diretório servido, absoluto
 * @param {string} pathname `url.pathname` do request (começa com `/`)
 * @returns {string | null}
 */
export function resolveWithinDist(distDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // percent-encoding inválido
  }
  if (decoded.includes('\0') || !decoded.startsWith('/')) return null;

  const resolved = path.resolve(distDir, `.${decoded}`);
  const contained = resolved === distDir || resolved.startsWith(distDir + path.sep);
  return contained ? resolved : null;
}

/** @param {string} filePath @returns {string | null} */
function fileOrNull(filePath) {
  try {
    return fs.statSync(filePath).isFile() ? filePath : null;
  } catch {
    return null;
  }
}

/**
 * Arquivo a servir: o pedido, seu `index.html`, ou o `index.html` da raiz
 * (fallback de SPA).
 *
 * @param {string} distDir
 * @param {string} pathname
 * @returns {string | null} `null` quando o pedido escapa do dist
 */
export function resolveAsset(distDir, pathname) {
  const target = resolveWithinDist(distDir, pathname);
  if (target === null) return null;

  return (
    fileOrNull(target) ??
    fileOrNull(path.join(target, 'index.html')) ??
    path.join(distDir, 'index.html')
  );
}

/** @param {string} filePath @returns {string} */
export function contentTypeFor(filePath) {
  return MIME[path.extname(filePath)] ?? 'application/octet-stream';
}

export const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const resolved = resolveAsset(DIST, url.pathname);

  if (resolved === null) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypeFor(resolved) });
    res.end(data);
  });
});

// Só escuta quando executado direto — importar o módulo (teste) não sobe porta.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    process.stdout.write(`Server listening on port ${PORT}\n`);
  });
}
