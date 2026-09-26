export type BootMode =
  | { kind: 'dev-server'; rendererUrl: string }
  | { kind: 'external-backend'; backendUrl: string }
  | { kind: 'embedded' };

const BACKEND_URL_FLAG = '--backend-url=';

export const resolveBootMode = (env: NodeJS.ProcessEnv, argv: readonly string[]): BootMode => {
  const devServerUrl = env['VITE_DEV_SERVER_URL'];
  if (devServerUrl) return { kind: 'dev-server', rendererUrl: devServerUrl };
  const flag = argv.find((argument) => argument.startsWith(BACKEND_URL_FLAG))?.slice(BACKEND_URL_FLAG.length);
  const backendUrl = flag ?? env['MM_BACKEND_URL'];
  if (backendUrl) return { kind: 'external-backend', backendUrl: backendUrl.replace(/\/+$/, '') };
  return { kind: 'embedded' };
};
