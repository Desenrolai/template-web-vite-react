import { readFileSync } from 'node:fs';
import { cpus } from 'node:os';

/**
 * Num container, `os.cpus()` reporta as CPUs do HOST, não o limite do cgroup.
 * Dimensionar o pool de teste por ele cria workers demais: o job morre por
 * pressão de memória/CPU **com todos os testes passando**, o que parece
 * flakiness e não é. Estes helpers leem o limite real do cgroup.
 */

const CGROUP_V2_CPU_MAX = '/sys/fs/cgroup/cpu.max';
const CGROUP_V1_QUOTA = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us';
const CGROUP_V1_PERIOD = '/sys/fs/cgroup/cpu/cpu.cfs_period_us';

export type ReadFile = (path: string) => string;

const readFileUtf8: ReadFile = (path) => readFileSync(path, 'utf8');

function tryRead(readFile: ReadFile, path: string): string | null {
  try {
    return readFile(path);
  } catch {
    return null;
  }
}

function toCpuCount(quota: number, period: number): number | null {
  if (!Number.isFinite(quota) || !Number.isFinite(period)) return null;
  if (quota <= 0 || period <= 0) return null;
  return quota / period;
}

function readCgroupV2(readFile: ReadFile): number | null {
  const raw = tryRead(readFile, CGROUP_V2_CPU_MAX);
  if (raw === null) return null;

  const [quota, period] = raw.trim().split(/\s+/);
  if (quota === undefined || quota === 'max') return null; // sem limite de CPU

  return toCpuCount(Number(quota), Number(period));
}

function readCgroupV1(readFile: ReadFile): number | null {
  const quota = tryRead(readFile, CGROUP_V1_QUOTA);
  const period = tryRead(readFile, CGROUP_V1_PERIOD);
  if (quota === null || period === null) return null;

  const quotaUs = Number(quota.trim());
  if (quotaUs <= 0) return null; // -1 = sem limite de CPU

  return toCpuCount(quotaUs, Number(period.trim()));
}

/**
 * CPUs que o cgroup concede a este processo, ou `null` quando não há cgroup
 * legível ou o limite é "sem limite". Tenta v2 e cai para v1.
 */
export function cgroupCpuLimit(readFile: ReadFile = readFileUtf8): number | null {
  return readCgroupV2(readFile) ?? readCgroupV1(readFile);
}

/**
 * Número de workers do pool de teste. Nunca acima do que o cgroup permite e
 * nunca abaixo de 1 (`cpu.max` fracionário arredonda para baixo, mas 0 worker
 * trava a suíte).
 */
export function maxTestWorkers(
  readFile: ReadFile = readFileUtf8,
  hostCpuCount: number = cpus().length,
): number {
  const host = Math.max(1, hostCpuCount);
  const limit = cgroupCpuLimit(readFile);
  if (limit === null) return host;

  return Math.max(1, Math.min(host, Math.floor(limit)));
}
