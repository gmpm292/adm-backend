import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PubSubRedisOptions, RedisPubSub } from 'graphql-redis-subscriptions';

export const REDIS_PUB_SUB_TOKEN = 'REDIS_PUB_SUB_TOKEN';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_PUB_SUB_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const options: PubSubRedisOptions = {
          connection: {
            host: configService.get<string>('SUBSCRIPTION_REDIS_HOST') ?? '',
            port: parseInt(
              configService.get<string>('SUBSCRIPTION_REDIS_PORT') ?? '6379',
            ),
            db: 0,
            commandQueue: true,
            commandTimeout: 5000,
          },
        };
        return new RedisPubSub(options);
      },
    },
  ],
  exports: [REDIS_PUB_SUB_TOKEN],
})
export class PubsubModule {}
