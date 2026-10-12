/**
 * Archivos `.env` que se cargan. En test, `.env.test` va primero y sus
 * valores mandan sobre los de `.env`.
 */
export function getEnvFilesToLoad(): string[] {
  return process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'];
}
