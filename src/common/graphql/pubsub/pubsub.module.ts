import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PubSubRedisOptions, RedisPubSub } from 'graphql-redis-subscriptions';
import { getRedisConnection } from '../../config/helpers/connection.helper';

/**
 * Token para inyectar el PubSub de Redis con el que se publican y escuchan
 * las suscripciones GraphQL (conexión `SUBSCRIPTION_*` o `REDIS_URL`).
 */
export const REDIS_PUB_SUB_TOKEN = 'REDIS_PUB_SUB_TOKEN';
const logger = new Logger('RedisPubSub');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_PUB_SUB_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options: PubSubRedisOptions = {
          connection: {
            ...getRedisConnection(
              (key) => configService.get<string>(key),
              'SUBSCRIPTION',
            ),
            retryStrategy: (times: number) => Math.min(times * 50, 2000),
            connectTimeout: 5000,
          },
        };

        const pubSub = new RedisPubSub(options);

        // Verificación de conexión
        pubSub.getSubscriber().on('connect', () => {
          logger.log('Conectado a Redis PubSub exitosamente');
        });

        pubSub.getSubscriber().on('error', (err) => {
          logger.error('Error en Redis PubSub:', err);
        });

        return pubSub;
      },
    },
  ],
  exports: [REDIS_PUB_SUB_TOKEN],
})
export class PubsubModule {}
