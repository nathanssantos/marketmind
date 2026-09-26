import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { missingResources, postgresPackageForPlatform, resolveEmbeddedResources } from '../resources';

describe('embedded resources', () => {
  it('maps each supported platform to its PostgreSQL package', () => {
    expect(postgresPackageForPlatform('darwin', 'arm64')).toBe('@embedded-postgres/darwin-arm64');
    expect(postgresPackageForPlatform('win32', 'x64')).toBe('@embedded-postgres/windows-x64');
    expect(() => postgresPackageForPlatform('freebsd', 'x64')).toThrow('freebsd-x64');
  });

  it('reads everything from the resources folder when packaged', () => {
    const resources = resolveEmbeddedResources({ resourcesPath: '/App/Contents/Resources', appRoot: '/ignored', isPackaged: true, platform: 'darwin', arch: 'arm64' });
    expect(resources).toEqual({
      backendEntry: '/App/Contents/Resources/backend/index.js',
      backendVendorDir: '/App/Contents/Resources/backend/vendor',
      migrationsDir: '/App/Contents/Resources/backend/migrations',
      builtinStrategiesDir: '/App/Contents/Resources/backend/strategies/builtin',
      rendererDir: '/App/Contents/Resources/renderer',
      postgresBinDir: '/App/Contents/Resources/postgres/bin',
    });
  });

  it('uses the workspace build outputs when not packaged', () => {
    const resources = resolveEmbeddedResources({ resourcesPath: '/unused', appRoot: '/repo/apps/electron', isPackaged: false, platform: 'win32', arch: 'x64' });
    expect(resources.backendEntry).toBe(path.normalize('/repo/apps/backend/dist-embedded/index.js'));
    expect(resources.rendererDir).toBe(path.join('/repo/apps/electron', 'dist'));
    expect(resources.postgresBinDir).toBe(path.join('/repo/apps/electron', 'node_modules', '@embedded-postgres/windows-x64', 'native', 'bin'));
  });

  it('lets an override folder win over both layouts', () => {
    const resources = resolveEmbeddedResources({ resourcesPath: '/a', appRoot: '/b', isPackaged: true, platform: 'darwin', arch: 'x64', override: '/custom' });
    expect(resources.backendEntry).toBe('/custom/backend/index.js');
  });

  describe('missingResources', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'mm-resources-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('lists only the locations that do not exist', () => {
      mkdirSync(path.join(dir, 'backend', 'migrations'), { recursive: true });
      writeFileSync(path.join(dir, 'backend', 'index.js'), '');
      const resources = resolveEmbeddedResources({ resourcesPath: dir, appRoot: '/b', isPackaged: true, platform: 'darwin', arch: 'arm64' });
      expect(missingResources(resources)).toEqual([resources.backendVendorDir, resources.builtinStrategiesDir, resources.rendererDir, resources.postgresBinDir]);
    });
  });
});
