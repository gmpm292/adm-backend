import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '../config';
import * as redisStore from 'cache-manager-redis-store';
import { isRedisRemote } from '../graphql/helpers/isRedisRemote.helper';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('CACHE_REDIS_HOST') ?? '',
        port: parseInt(configService.get<string>('CACHE_REDIS_PORT') ?? '6379'),
        password: configService.get<string>('CACHE_REDIS_PASSWORD'),
        ttl: 60 * 60 * 24 * 3, // tiempo de vida por defecto: 3 dias.
        tls: isRedisRemote() ? { rejectUnauthorized: false } : undefined,
        // cache-manager-redis-store pasa estas opciones directo al cliente
        // "redis"@3 (no a ioredis): usa connect_timeout/retry_strategy
        // (snake_case), no commandTimeout/retryStrategy. Con los nombres
        // equivocados el cliente caía en sus valores por defecto (reintentos
        // infinitos, 1h de connect_timeout) y las peticiones se colgaban sin
        // límite si Redis no conectaba, hasta que el router cortaba la conexión.
        connect_timeout: 10000,
        enable_offline_queue: false,
        retry_strategy: (options: {
          attempt: number;
          total_retry_time: number;
        }) => {
          if (options.total_retry_time > 10000) {
            return new Error('Redis: tiempo de reintento agotado');
          }
          return Math.min(options.attempt * 100, 2000);
        },
        // Limpia las claves que no tienen valor o están undefined
        ...(configService.get<string>('CACHE_REDIS_PASSWORD')
          ? {}
          : { password: undefined }),
        ...(isRedisRemote() ? {} : { tls: undefined }),
      }),
      isGlobal: true,
    }),
  ],
})
export class CacheManagerModule {}
