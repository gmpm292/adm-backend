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
        commandTimeout: 5000,
        tls: isRedisRemote() ? { rejectUnauthorized: false } : undefined,
        retryStrategy: (times: number) => {
          return Math.min(times * 50, 2000);
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
