import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { botConfigSchema, type BotConfig } from './schema.js';

function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, name: string) => process.env[name] ?? '');
}

function substituteInObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteInObject);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, substituteInObject(v)]),
    );
  }
  return obj;
}

export function loadConfig(filePath: string): BotConfig {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(raw);
  const withEnv = substituteInObject(parsed);
  return botConfigSchema.parse(withEnv);
}

export function validateConfig(filePath: string): { valid: boolean; config?: BotConfig; errors?: string[] } {
  try {
    const config = loadConfig(filePath);
    return { valid: true, config };
  } catch (err) {
    if (err instanceof Error) {
      return { valid: false, errors: [err.message] };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}
