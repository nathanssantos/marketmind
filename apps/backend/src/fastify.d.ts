import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
  }

  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: {
        path?: string;
        maxAge?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'strict' | 'lax' | 'none';
      }
    ): FastifyReply;
    clearCookie(name: string, options?: { path?: string }): FastifyReply;
  }
}
