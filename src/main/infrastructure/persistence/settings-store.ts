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

  async setMultiple(entries: Record<string, string>): Promise<void> {
    const data = await this.readAll();
    Object.assign(data, entries);
    await this.writeAll(data);
  }

  async getMultiple(keys: string[]): Promise<Record<string, string>> {
    const data = await this.readAll();
    const result: Record<string, string> = {};
    for (const key of keys) {
      if (data[key] !== undefined) result[key] = data[key];
    }
    return result;
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
