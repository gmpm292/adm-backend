import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PubSubRedisOptions, RedisPubSub } from 'graphql-redis-subscriptions';
import { isRedisRemote } from '../helpers/isRedisRemote.helper';

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
            host: configService.get<string>('SUBSCRIPTION_REDIS_HOST'),
            port: parseInt(
              configService.get<string>('SUBSCRIPTION_REDIS_PORT') || '6379',
            ),
            password: configService.get<string>('SUBSCRIPTION_REDIS_PASSWORD'),
            tls: isRedisRemote() ? { rejectUnauthorized: false } : undefined,
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

// import { Global, Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { PubSubRedisOptions, RedisPubSub } from 'graphql-redis-subscriptions';
// import { RedisOptions } from 'ioredis';
// import { isRedisRemote } from '../helpers/isRedisRemote.helper';

// export const REDIS_PUB_SUB_TOKEN = 'REDIS_PUB_SUB_TOKEN';

// @Global()
// @Module({
//   imports: [ConfigModule],
//   providers: [
//     {
//       provide: REDIS_PUB_SUB_TOKEN,
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => {
//         const options: PubSubRedisOptions = {
//           connection: {
//             host: configService.get<string>('SUBSCRIPTION_REDIS_HOST') ?? '',
//             port: parseInt(
//               configService.get<string>('SUBSCRIPTION_REDIS_PORT') ?? '6379',
//             ),
//             password: configService.get<string>('SUBSCRIPTION_REDIS_PASSWORD'),
//             commandQueue: true,
//             commandTimeout: 5000,
//             tls: isRedisRemote() ? { rejectUnauthorized: false } : undefined,
//             retryStrategy: (times: number) => {
//               return Math.min(times * 50, 2000);
//             },
//           },
//         };
//         if (!(options.connection as RedisOptions).password) {
//           delete (options.connection as RedisOptions).password;
//         }
//         if (!(options.connection as RedisOptions).tls) {
//           delete (options.connection as RedisOptions).tls;
//         }
//         return new RedisPubSub(options);
//       },
//     },
//   ],
//   exports: [REDIS_PUB_SUB_TOKEN],
// })
// export class PubsubModule {}
