/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { AppInfoInput } from '../dto/appInfo.input';
import { AppLoggerService } from '../../../common/logger/logger.service';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { EntityManager } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { REDIS_PUB_SUB_TOKEN } from '../../../common/graphql/pubsub/pubsub.module';
import { ConfigService } from '../../../common/config';

@Injectable()
export class AppInfoService {
  constructor(
    private logger: AppLoggerService,
    @Inject(REDIS_PUB_SUB_TOKEN) private readonly pubSub: RedisPubSub,
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private readonly configService: ConfigService,
  ) {}

  public appInfo() {
    const { name, version, description } = JSON.parse(
      readFileSync('package.json', 'utf8'),
    );
    return {
      name,
      version,
      description,
    };
  }

  public updateAppInfo(input: AppInfoInput) {
    return input;
  }

  public notify(arg: { notify: Array<string>; message: string }) {
    const graphqlNotifications = arg;

    this.pubSub
      .publish('graphqlNotifications', { graphqlNotifications })
      .catch((error) =>
        this.logger.error(
          `Some error happen when publish graphqlNotifications.
           ${JSON.stringify(arg)}`,
          error,
        ),
      );
  }
}
