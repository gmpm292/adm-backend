/**
 * Return a list of environment variables files path
 */
export function getEnvFilesToLoad(): string[] {
  return process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'];
}
