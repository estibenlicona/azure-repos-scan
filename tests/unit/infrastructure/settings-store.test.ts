import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, mkdir } from 'node:fs/promises';

// Mock config so getAppDataPath returns a unique temp directory per run
const testDir = path.join(os.tmpdir(), `test-azure-repos-scan-settings-${randomUUID()}`);

vi.mock('../../../src/main/infrastructure/config.js', () => ({
  getAppDataPath: () => testDir,
}));

// Import after mock is set up
const { SettingsStore } = await import(
  '../../../src/main/infrastructure/persistence/settings-store.js'
);

describe('SettingsStore', () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should return default value for missing key', async () => {
    const store = new SettingsStore();
    const value = await store.get('nonexistent', 'fallback');
    expect(value).toBe('fallback');
  });

  it('should return empty string as default when no default provided', async () => {
    const store = new SettingsStore();
    const value = await store.get('nonexistent');
    expect(value).toBe('');
  });

  it('should save and retrieve a value', async () => {
    const store = new SettingsStore();
    await store.set('org', 'my-organization');
    const value = await store.get('org');
    expect(value).toBe('my-organization');
  });

  it('should overwrite existing value', async () => {
    const store = new SettingsStore();
    await store.set('theme', 'light');
    await store.set('theme', 'dark');
    const value = await store.get('theme');
    expect(value).toBe('dark');
  });

  it('should persist across instances (read from file)', async () => {
    const store1 = new SettingsStore();
    await store1.set('apiUrl', 'https://dev.azure.com');

    // Create a new instance — should read the same file
    const store2 = new SettingsStore();
    const value = await store2.get('apiUrl');
    expect(value).toBe('https://dev.azure.com');
  });

  it('should handle missing file gracefully', async () => {
    // Remove the directory so there's definitely no file
    await rm(testDir, { recursive: true, force: true });

    const store = new SettingsStore();
    const value = await store.get('anything', 'default-val');
    expect(value).toBe('default-val');
  });
});
