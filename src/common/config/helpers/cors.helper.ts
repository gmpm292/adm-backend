/**
 * Orígenes permitidos por CORS según `CORS_ORIGIN`: lista separada por comas,
 * o `*` para aceptar cualquiera (devuelve `true`). Sin la variable, ninguno.
 */
export function parseOriginFromEnvironment(): string[] | boolean {
  const { CORS_ORIGIN } = process.env;

  const origin =
    CORS_ORIGIN !== '*'
      ? (CORS_ORIGIN?.split(',').map((origin: string) => origin.trim()) ?? [])
      : true;

  return origin;
}
