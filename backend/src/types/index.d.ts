import "@fastify/secure-session";

declare module "@fastify/secure-session" {
  interface SessionData {
    user: {
      id: string;
      role: string;
      email: string;
      pwdVersion?: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    session: import("@fastify/secure-session").Session;
  }
}
