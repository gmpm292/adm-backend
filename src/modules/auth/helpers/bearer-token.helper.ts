const bearerPrefix = 'Bearer';

export function addBearerPrefix(token: string): string {
  return `${bearerPrefix} ${token}`;
}

export function removeBearerPrefix(bearerToken: string): string {
  return bearerToken?.substring(bearerPrefix.length).trim();
}
