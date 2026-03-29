/** Key-value JSON persistence for user settings. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getAppDataPath } from '../config.js';

export class SettingsStore {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(getAppDataPath(), 'settings.json');
  }

  async get(key: string, defaultValue: string = ''): Promise<string> {
    const data = await this.readAll();
    return data[key] ?? defaultValue;
  }

  async set(key: string, value: string): Promise<void> {
    const data = await this.readAll();
    data[key] = value;
    await this.writeAll(data);
  }

  private async readAll(): Promise<Record<string, string>> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async writeAll(data: Record<string, string>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
