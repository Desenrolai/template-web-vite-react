# template-web-vite-react

Template base para SPAs da Desenrolai. Gerado pelo forge em `forge.desenrol.ai`.

## Stack

- **Vite 8** + **React 19** + **TypeScript 6** strict
- **Vitest 4** + Testing Library
- **ESLint 10** (flat config) + Prettier
- **Node 24 LTS**
- Servido em produção por um **static server em Node** (`server.mjs`), não nginx

## Começando

```bash
npm install
npm run dev
```

## Scripts

| Comando             | Descrição                                           |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                         |
| `npm run build`     | Typecheck + build de produção (`dist/`)             |
| `npm run preview`   | Preview do build                                    |
| `npm start`         | Sobe o static server de produção (`server.mjs`)     |
| `npm run lint`      | ESLint                                              |
| `npm run format`    | Prettier (check) — `format:write` corrige           |
| `npm run typecheck` | `tsc -b`                                            |
| `npm test`          | Vitest — `test:watch` e `test:coverage` disponíveis |

## Por que não nginx

O forge sobe o pod com `readOnlyRootFilesystem: true` e o nginx precisa escrever em
`/var/cache/nginx`. `server.mjs` serve o `dist/` só com a stdlib do Node — sem dependência,
sem escrita em disco, com fallback de SPA para `index.html`.

Ele decodifica o pathname antes de resolver o caminho e recusa qualquer caminho resolvido
que caia fora de `dist/`. Medido: o parser de `new URL` já remove segmentos `..` — inclusive
percent-encoded — então por HTTP a travessia nem chega ao resolvedor; a contenção é defesa
em profundidade para chamada direta e para refactor futuro. `server.test.mjs` cobre
travessia crua, percent-encoded, irmão de nome parecido, encoding inválido e byte nulo, e
mutar a comparação de contenção derruba 3 testes.

## Pool de teste dentro de container

`os.cpus()` reporta as CPUs do **host**, não o limite do cgroup. Dimensionar o pool do
Vitest por ele cria workers demais e o job morre por pressão de recurso **com todos os
testes passando**. `tooling/cgroup-cpus.ts` lê `/sys/fs/cgroup/cpu.max` (v2, com fallback
para `cpu.cfs_quota_us`/`cpu.cfs_period_us` do v1) e alimenta `maxWorkers` em
`vitest.config.ts`.

## Deploy

Imagem multi-stage sobre `node:24-alpine`, rodando como **uid 1001** e compatível com
`readOnlyRootFilesystem: true`. Porta **8080**, health check em `/` — o mesmo
`healthPath` declarado no `forge.yaml`.

```
ghcr.io/desenrolai/<nome-do-repo>:main
```
