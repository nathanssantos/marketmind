import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(backendRoot, 'dist-embedded');

const NATIVE_PACKAGES = ['@node-rs/argon2'];
const EXTERNALS = [...NATIVE_PACKAGES, 'pg-native', 'bufferutil', 'utf-8-validate', 'pino-pretty'];

const copyPackage = (packageName, resolveFrom = [backendRoot]) => {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: resolveFrom });
  const sourceDir = path.dirname(packageJsonPath);
  const targetDir = path.join(outDir, 'node_modules', packageName);
  mkdirSync(path.dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true, dereference: true });
  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const installedOptionals = Object.keys(manifest.optionalDependencies ?? {}).filter((optional) => {
    try {
      require.resolve(`${optional}/package.json`, { paths: [sourceDir] });
      return true;
    } catch {
      return false;
    }
  });
  for (const optional of installedOptionals) copyPackage(optional, [sourceDir]);
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(backendRoot, 'src', 'index.ts')],
  outfile: path.join(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: EXTERNALS,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'info',
});

writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ name: 'marketmind-backend-embedded', type: 'module', private: true }, null, 2));
for (const packageName of NATIVE_PACKAGES) copyPackage(packageName);
cpSync(path.join(backendRoot, 'strategies', 'builtin'), path.join(outDir, 'strategies', 'builtin'), { recursive: true });
cpSync(path.join(backendRoot, 'src', 'db', 'migrations'), path.join(outDir, 'migrations'), { recursive: true });

const userStrategiesDir = path.join(backendRoot, 'strategies', 'user');
if (existsSync(userStrategiesDir)) console.log(`Note: ${userStrategiesDir} is not bundled; user strategies load from the data folder.`);
console.log(`Embedded backend written to ${outDir}`);
