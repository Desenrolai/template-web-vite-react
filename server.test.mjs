import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { contentTypeFor, resolveWithinDist } from './server.mjs';

const DIST = path.resolve('/srv/app/dist');

describe('resolveWithinDist', () => {
  it('resolve um arquivo comum dentro do dist', () => {
    expect(resolveWithinDist(DIST, '/assets/app.js')).toBe(path.join(DIST, 'assets', 'app.js'));
  });

  it('resolve a raiz', () => {
    expect(resolveWithinDist(DIST, '/')).toBe(DIST);
  });

  it('normaliza travessia que volta para dentro do dist', () => {
    expect(resolveWithinDist(DIST, '/assets/../index.html')).toBe(path.join(DIST, 'index.html'));
  });

  it('recusa travessia com `../`', () => {
    expect(resolveWithinDist(DIST, '/../../etc/passwd')).toBeNull();
  });

  // Chamada direta: por HTTP o `new URL` já teria removido os segmentos `..`,
  // inclusive nesta forma percent-encoded. Aqui a contenção é quem barra.
  it('recusa travessia percent-encoded', () => {
    expect(resolveWithinDist(DIST, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
  });

  // Controle de prefixo: `startsWith(distDir)` sozinho deixaria passar um irmão
  // de nome parecido. O separador na comparação é o que fecha esse buraco.
  it('recusa irmão de nome parecido com o do dist', () => {
    expect(resolveWithinDist(DIST, '/../dist-secreto/segredo.txt')).toBeNull();
  });

  it('recusa pathname que não começa com barra', () => {
    expect(resolveWithinDist(DIST, 'etc/passwd')).toBeNull();
  });

  it('recusa percent-encoding inválido', () => {
    expect(resolveWithinDist(DIST, '/%ZZ')).toBeNull();
  });

  it('recusa byte nulo', () => {
    expect(resolveWithinDist(DIST, '/app%00.js')).toBeNull();
  });
});

describe('contentTypeFor', () => {
  it('mapeia as extensões conhecidas', () => {
    expect(contentTypeFor('/x/index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('/x/app.js')).toBe('application/javascript');
    expect(contentTypeFor('/x/logo.svg')).toBe('image/svg+xml');
  });

  it('cai para octet-stream no desconhecido', () => {
    expect(contentTypeFor('/x/arquivo.qualquer')).toBe('application/octet-stream');
  });
});
