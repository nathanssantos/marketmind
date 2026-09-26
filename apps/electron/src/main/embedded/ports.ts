import net from 'node:net';

export const LOOPBACK_HOST = '127.0.0.1';

export const findFreePort = (host: string = LOOPBACK_HOST): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => (port ? resolve(port) : reject(new Error('Could not reserve a free port'))));
    });
  });
