import { existsSync } from 'node:fs';
import path from 'node:path';

export interface EmbeddedResources {
  backendEntry: string;
  backendModulesDir: string;
  migrationsDir: string;
  builtinStrategiesDir: string;
  rendererDir: string;
  postgresBinDir: string;
}

const POSTGRES_PACKAGE_BY_PLATFORM: Partial<Record<`${NodeJS.Platform}-${NodeJS.Architecture}`, string>> = {
  'darwin-arm64': '@embedded-postgres/darwin-arm64',
  'darwin-x64': '@embedded-postgres/darwin-x64',
  'win32-x64': '@embedded-postgres/windows-x64',
  'linux-x64': '@embedded-postgres/linux-x64',
  'linux-arm64': '@embedded-postgres/linux-arm64',
};

export const postgresPackageForPlatform = (platform: NodeJS.Platform, arch: NodeJS.Architecture): string => {
  const packageName = POSTGRES_PACKAGE_BY_PLATFORM[`${platform}-${arch}`];
  if (!packageName) throw new Error(`No embedded PostgreSQL build for ${platform}-${arch}`);
  return packageName;
};

export interface ResourceRoots {
  resourcesPath: string;
  appRoot: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  override?: string | undefined;
}

export const resolveEmbeddedResources = ({ resourcesPath, appRoot, isPackaged, platform, arch, override }: ResourceRoots): EmbeddedResources => {
  const root = override ?? (isPackaged ? resourcesPath : null);
  if (root) {
    return {
      backendEntry: path.join(root, 'backend', 'index.js'),
      backendModulesDir: path.join(root, 'backend', 'node_modules'),
      migrationsDir: path.join(root, 'backend', 'migrations'),
      builtinStrategiesDir: path.join(root, 'backend', 'strategies', 'builtin'),
      rendererDir: path.join(root, 'renderer'),
      postgresBinDir: path.join(root, 'postgres', 'bin'),
    };
  }
  const backendBundle = path.resolve(appRoot, '..', 'backend', 'dist-embedded');
  return {
    backendEntry: path.join(backendBundle, 'index.js'),
    backendModulesDir: path.join(backendBundle, 'node_modules'),
    migrationsDir: path.join(backendBundle, 'migrations'),
    builtinStrategiesDir: path.join(backendBundle, 'strategies', 'builtin'),
    rendererDir: path.join(appRoot, 'dist'),
    postgresBinDir: path.join(appRoot, 'node_modules', postgresPackageForPlatform(platform, arch), 'native', 'bin'),
  };
};

export const missingResources = (resources: EmbeddedResources): string[] =>
  Object.values(resources).filter((location) => !existsSync(location));
