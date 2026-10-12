import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '../config';
import * as redisStore from 'cache-manager-redis-store';
import { getRedisConnection } from '../config/helpers/connection.helper';

/**
 * Caché global sobre Redis (sesiones activas, entre otras). Ojo: con este
 * store el TTL va como `{ ttl: segundos }`; un número suelto se ignora.
 */
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        ...getRedisConnection(
          (key) => configService.get<string>(key),
          'CACHE',
        ),
        ttl: 60 * 60 * 24 * 3, // tiempo de vida por defecto: 3 dias.
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
      }),
      isGlobal: true,
    }),
  ],
})
export class CacheManagerModule {}
