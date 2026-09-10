import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Este arquivo não testa o CI — testa a FIAÇÃO dos gatilhos do CI.
 *
 * O defeito que ele fixa: com `push` em toda branch e `pull_request` declarados
 * juntos, cada commit de uma branch com PR aberto dispara DOIS runs completos do
 * mesmo SHA. Medido em repo gerado a partir de um destes templates: o mesmo SHA
 * com um run `success` e outro `failure`, criados com 4s de diferença. E o que
 * faz alguém concluir "flaky" e ignorar o vermelho.
 *
 * O `concurrency` do workflow NÃO protege, e é aí que a leitura engana: a chave
 * é `github.ref`, que vale `refs/heads/<branch>` no push e `refs/pull/<n>/merge`
 * no pull_request. Grupos diferentes, zero cancelamento. Quem confere apenas que
 * existe um bloco `concurrency` conclui, errado, que o caso está resolvido.
 */

const repoRoot = join(import.meta.dirname, '..');
const workflowRaw = readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

/**
 * Remove linhas de comentário do YAML.
 *
 * Obrigatório aqui: o comentário do próprio workflow documenta o defeito e cita
 * o gatilho antigo textualmente. Sem esta limpeza, a prosa que explica a
 * correção seria lida como a volta do defeito — comentário virando achado.
 */
export function stripYamlComments(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

const workflow = stripYamlComments(workflowRaw);

const inicio = workflow.search(/^on:/m);
const fim = workflow.search(/^concurrency:/m);
const gatilhos = inicio >= 0 && fim > inicio ? workflow.slice(inicio, fim) : '';

describe('gatilhos do CI', () => {
  // Sem esta âncora, um recorte que falhasse deixaria os `not.toMatch` abaixo
  // passando sobre string vazia — o teste ficaria verde medindo o nada.
  it('o bloco de gatilhos foi recortado (senão os demais testes medem o vazio)', () => {
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fim).toBeGreaterThan(inicio);
    expect(gatilhos).toContain('push:');
  });

  it('push roda só na branch default', () => {
    expect(gatilhos).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
  });

  it('pull_request cobre toda branch, inclusive PR de fork', () => {
    expect(gatilhos).toMatch(/pull_request:\s*\n\s*branches:\s*\[['"]\*\*['"]\]/);
  });

  it('push em toda branch não volta: duplicaria o run do mesmo SHA', () => {
    expect(gatilhos).not.toMatch(/push:\s*\n\s*branches:\s*\[['"]\*\*['"]\]/);
  });

  // Um teste que o CI não executa é exatamente a classe de defeito que este
  // arquivo existe para impedir.
  it('o CI executa a suíte que contém este teste', () => {
    expect(workflow).toContain('npm test');
  });

  it('a remoção de comentário não come conteúdo', () => {
    expect(stripYamlComments('# nota\n  # indentado\nrun: npm ci\n')).toBe('run: npm ci\n');
    expect(stripYamlComments('run: echo "a # b"\n')).toContain('a # b');
  });
});
