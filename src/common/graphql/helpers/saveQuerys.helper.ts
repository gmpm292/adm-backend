/* eslint-disable @typescript-eslint/no-unused-vars */

import { GraphQLSchema } from 'graphql';
import { ConfigService } from '../../config';
import { AppLoggerService } from '../../logger/logger.service';

export function saveQuerys(
  schema: GraphQLSchema,
  loggerService: AppLoggerService,
  configService: ConfigService,
): void {
  const operations = [
    {
      type: 'Query',
      values: Object.keys(schema.getQueryType()?.getFields() || {}),
    },
    {
      type: 'Mutation',
      values: Object.keys(schema.getMutationType()?.getFields() || {}),
    },
    {
      type: 'Subscription',
      values: Object.keys(schema.getSubscriptionType()?.getFields() || {}),
    },
  ];
  for (const t of operations) {
    for (const val of t.values) {
      try {
        //await configService.saveQueryOrEndPointURL(val, t.type);
      } catch (error) {
        console.log(error);
      }
    }
  }
}
