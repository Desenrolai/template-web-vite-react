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

### A checagem de contenção em `resolveWithinDist` não é redundante — não a remova

`server.mjs` decodifica o pathname antes de resolver o caminho e recusa (403) qualquer
caminho resolvido que caia fora de `dist/`. É tentador achar que o `new URL` já cobre isso.
**Não cobre.** Medido, request a request, no container:

| Request                     | O que o `new URL` faz                  | Quem barra                     |
| --------------------------- | -------------------------------------- | ------------------------------ |
| `/../../etc/passwd`         | normaliza → `/etc/passwd`              | o próprio `new URL`            |
| `/%2e%2e/%2e%2e/etc/passwd` | normaliza → `/etc/passwd`              | o próprio `new URL`            |
| `/..%2f..%2fetc/passwd`     | **não normaliza** — pathname chega cru | **só a checagem de contenção** |

A barra percent-encoded (`%2f`, e `%2F`) impede a divisão em segmentos, então o parser não
enxerga `..` para remover e o caminho chega inteiro ao resolvedor. Nesse caso o
`decodeURIComponent` + `path.resolve` + comparação de prefixo é a **única** linha de defesa
contra um ataque que chega vivo por HTTP.

Reproduzindo à mão, use **sempre `curl --path-as-is`**. Sem a flag o curl normaliza `../`
do lado do cliente e envia `GET /etc/passwd` na linha do request — o servidor nunca vê a
travessia e o teste dá falso negativo (com `%2f` o curl envia intacto, mas não vale
depender de qual forma você está testando):

```bash
curl -i --path-as-is "http://localhost:8080/..%2f..%2f..%2f..%2fetc/passwd"   # 403
```

Provado nos dois sentidos: com a checagem, o request devolve **403**; com a comparação
neutralizada para `true`, o mesmo request passou a devolver **200 com o conteúdo real de
`/etc/passwd`**. `server.test.mjs` cobre as três formas (mais irmão de nome parecido,
encoding inválido e byte nulo) e a mutação derruba **5 testes**.

## Pool de teste dentro de container

`os.cpus()` reporta as CPUs do **host**, não o limite do cgroup. Dimensionar o pool do
Vitest por ele cria workers demais e o job morre por pressão de recurso **com todos os
testes passando**. `tooling/cgroup-cpus.ts` lê `/sys/fs/cgroup/cpu.max` (v2, com fallback
para `cpu.cfs_quota_us`/`cpu.cfs_period_us` do v1) e alimenta `maxWorkers` em
`vitest.config.ts`.

## Repo privado: o CI nasce morto sem estas variáveis

Este template é um repositório **público**, onde o GitHub Actions em runner hospedado é
gratuito e ilimitado — por isso o CI daqui está verde. O repo que você gera a partir dele
é **privado**, e lá a cota de minutos hospedados está esgotada. Antes do primeiro push,
defina duas _repository variables_ (Settings → Secrets and variables → Actions →
Variables):

| Variável           | Valor                              |
| ------------------ | ---------------------------------- |
| `CI_RUNNER`        | `["self-hosted","desenrolai"]`     |
| `CI_RUNNER_DOCKER` | `["self-hosted","docker-builder"]` |

O `runs-on` lê essas variáveis e cai em `ubuntu-latest` quando elas não existem — é o que
mantém o CI deste template rodando em runner hospedado. O `fromJSON` não é enfeite: um
runner self-hosted da casa é um **conjunto de labels**, e `self-hosted,desenrolai` como
string simples viraria um único label com vírgula no nome, que não casa com runner nenhum.

> ⚠️ **O sintoma de não fazer isto não parece falta de runner.** O job morre em ~2
> segundos com **`steps: 0`** — nenhum step aparece, nenhum log de erro, nada que aponte
> para billing. Parece YAML quebrado, e a pessoa perde meia hora procurando erro de
> sintaxe. É cota.

## Deploy

Imagem multi-stage sobre `node:24-alpine`, rodando como **uid 1001** e compatível com
`readOnlyRootFilesystem: true`. Porta **8080**, health check em `/` — o mesmo
`healthPath` declarado no `forge.yaml`.

```
ghcr.io/desenrolai/<nome-do-repo>:main
```

Em **pull request** a imagem é construída e descartada — sem login no GHCR e sem
`packages: write`. É o que impede um `Dockerfile` quebrado de atravessar o PR verde.
