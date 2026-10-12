/**
 * Contexto de cada operación GraphQL. Las suscripciones (websocket) no traen
 * `req`: se simula uno cuyo `header()` devuelve el token de acceso que
 * `onConnect` dejó en `extra` al abrir la conexión.
 */
export function context({ req, res, extra }) {
  if (extra) {
    return {
      req: {
        header: () => `${extra.accessToken}`,
      } as unknown as Request,
    };
  }
  return { req, res };
}
