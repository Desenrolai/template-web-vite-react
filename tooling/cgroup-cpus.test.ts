import { describe, expect, it } from 'vitest';

import { cgroupCpuLimit, maxTestWorkers, type ReadFile } from './cgroup-cpus';

const V2 = '/sys/fs/cgroup/cpu.max';
const V1_QUOTA = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us';
const V1_PERIOD = '/sys/fs/cgroup/cpu/cpu.cfs_period_us';

/** Simula um filesystem: caminho ausente lança, como o `readFileSync` real. */
function fakeFs(files: Record<string, string>): ReadFile {
  return (path) => {
    const content = files[path];
    if (content === undefined) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    return content;
  };
}

describe('cgroupCpuLimit', () => {
  it('lê o limite do cgroup v2', () => {
    expect(cgroupCpuLimit(fakeFs({ [V2]: '200000 100000\n' }))).toBe(2);
  });

  it('trata cgroup v2 fracionário sem arredondar', () => {
    expect(cgroupCpuLimit(fakeFs({ [V2]: '150000 100000\n' }))).toBe(1.5);
  });

  it('devolve null quando o cgroup v2 diz "max" (sem limite)', () => {
    expect(cgroupCpuLimit(fakeFs({ [V2]: 'max 100000\n' }))).toBeNull();
  });

  it('cai para o cgroup v1 quando não há v2', () => {
    const fs = fakeFs({ [V1_QUOTA]: '400000\n', [V1_PERIOD]: '100000\n' });
    expect(cgroupCpuLimit(fs)).toBe(4);
  });

  it('devolve null quando a quota do v1 é -1 (sem limite)', () => {
    const fs = fakeFs({ [V1_QUOTA]: '-1\n', [V1_PERIOD]: '100000\n' });
    expect(cgroupCpuLimit(fs)).toBeNull();
  });

  it('devolve null quando nenhum arquivo de cgroup existe', () => {
    expect(cgroupCpuLimit(fakeFs({}))).toBeNull();
  });

  it('devolve null quando o conteúdo do cgroup não é numérico', () => {
    expect(cgroupCpuLimit(fakeFs({ [V2]: 'lixo aqui\n' }))).toBeNull();
  });
});

describe('maxTestWorkers', () => {
  it('usa o limite do cgroup quando ele é menor que o host', () => {
    expect(maxTestWorkers(fakeFs({ [V2]: '200000 100000\n' }), 16)).toBe(2);
  });

  it('nunca ultrapassa as CPUs do host, mesmo com cgroup mais generoso', () => {
    expect(maxTestWorkers(fakeFs({ [V2]: '3200000 100000\n' }), 4)).toBe(4);
  });

  it('arredonda para baixo um limite fracionário', () => {
    expect(maxTestWorkers(fakeFs({ [V2]: '150000 100000\n' }), 8)).toBe(1);
  });

  it('nunca devolve zero worker com cgroup abaixo de 1 CPU', () => {
    expect(maxTestWorkers(fakeFs({ [V2]: '50000 100000\n' }), 8)).toBe(1);
  });

  it('cai para as CPUs do host quando não há cgroup', () => {
    expect(maxTestWorkers(fakeFs({}), 6)).toBe(6);
  });

  it('cai para as CPUs do host quando o cgroup não impõe limite', () => {
    expect(maxTestWorkers(fakeFs({ [V2]: 'max 100000\n' }), 6)).toBe(6);
  });

  it('devolve ao menos 1 worker mesmo com host reportando 0 CPU', () => {
    expect(maxTestWorkers(fakeFs({}), 0)).toBe(1);
  });
});
