import { config } from 'dotenv';
import path from 'node:path';
import { app } from 'electron';

config();

export interface AppSettings {
  readonly azureDevOpsPat: string;
}

let cachedSettings: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cachedSettings) return cachedSettings;

  const pat = process.env['AZURE_DEVOPS_PAT'];
  if (!pat || pat.trim() === '') {
    throw new Error(
      'AZURE_DEVOPS_PAT environment variable is required. Set it in .env file.',
    );
  }

  cachedSettings = {
    azureDevOpsPat: pat.trim(),
  };
  return cachedSettings;
}

export function getAppDataPath(): string {
  const appData = app?.getPath?.('userData') ?? path.join(
    process.env['APPDATA'] ?? process.env['HOME'] ?? '.',
    'azure-repos-scan',
  );
  return appData;
}

export function clearSettingsCache(): void {
  cachedSettings = null;
}
