import { EnvironmentVariables } from '../environment-variables';

type EnvGetter = (key: keyof EnvironmentVariables) => string | undefined;

export interface RedisConnection {
  host: string;
  port: number;
  password?: string;
  tls?: { rejectUnauthorized: false };
}

export interface DatabaseConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: { rejectUnauthorized: false } | false;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres', 'redis'];

/** Hosts locales (o de contenedores): con ellos no se usa TLS ni SSL. */
function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.includes(host);
}

/**
 * Heroku cambia host, puerto y contraseña de sus add-ons cuando quiere
 * (mantenimiento, failover, rotación) y solo actualiza `REDIS_URL`. Por eso,
 * si llega, manda sobre las variables sueltas. Sus certificados son
 * autofirmados: con `rediss://` se usa TLS sin verificar el certificado.
 */
export function getRedisConnection(
  get: EnvGetter,
  prefix: 'CACHE' | 'SUBSCRIPTION',
): RedisConnection {
  const url = get('REDIS_URL');
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      tls:
        parsed.protocol === 'rediss:'
          ? { rejectUnauthorized: false }
          : undefined,
    };
  }

  const host = get(`${prefix}_REDIS_HOST`) ?? '';
  return {
    host,
    port: parseInt(get(`${prefix}_REDIS_PORT`) || '6379'),
    password: get(`${prefix}_REDIS_PASSWORD`) || undefined,
    tls: isLocalHost(host) ? undefined : { rejectUnauthorized: false },
  };
}

/** Igual que Redis: `DATABASE_URL` (la que actualiza Heroku) manda. */
export function getDatabaseConnection(get: EnvGetter): DatabaseConnection {
  const url = get('DATABASE_URL');
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432'),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
      ssl: isLocalHost(parsed.hostname) ? false : { rejectUnauthorized: false },
    };
  }

  const host = get('TYPEORM_HOST') ?? '';
  return {
    host,
    port: parseInt(get('TYPEORM_PORT') || '5432'),
    username: get('TYPEORM_USERNAME') ?? '',
    password: get('TYPEORM_PASSWORD') ?? '',
    database: get('TYPEORM_DATABASE') ?? '',
    ssl: isLocalHost(host) ? false : { rejectUnauthorized: false },
  };
}
