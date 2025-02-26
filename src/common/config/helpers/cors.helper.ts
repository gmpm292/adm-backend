/**
 * Returns an array with different origins configured in CORS_ORIGIN environment
 * variable
 */
export function parseOriginFromEnvironment(): string[] | boolean {
  const { CORS_ORIGIN } = process.env;

  const origin =
    CORS_ORIGIN !== '*'
      ? (CORS_ORIGIN?.split(',').map((origin: string) => origin.trim()) ?? [])
      : true;

  return origin;
}
