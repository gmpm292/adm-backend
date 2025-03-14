/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ConfigModule,
  ConfigService,
  parseOriginFromEnvironment,
} from '../config';

import { DateScalar } from './scalars/date.scalar';
import { JsonScalar } from './scalars/json.scalar';
import { GraphQLFormattedError } from 'graphql';
import { Context } from 'graphql-ws';
import { PubsubModule } from './pubsub/pubsub.module';
import { playground } from './helpers/playground.helper';
import { introspection } from './helpers/introspection.helper';
import { formatError } from './errors/format-error.helper';
import { extractSubscriptionCookies } from './helpers/extract-subscription-cookies.helper';
import { Socket } from 'dgram';
import { context } from '../config/helpers/context.helper';
import { LoggerModule } from '../logger';
import { AppLoggerService } from '../logger/logger.service';
import { AuthParameterKey } from '../../modules/auth/enums/auth-parameter-key.enum';
import { join } from 'path';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule, LoggerModule, PubsubModule],
      inject: [AppLoggerService, ConfigService],
      useFactory: (
        loggerService: AppLoggerService,
        configService: ConfigService,
      ) => ({
        // autoSchemaFile: true, // Genera el schema automáticamente
        // sortSchema: true,
        typePaths: ['./**/schema.graphql', './**/*.graphql'],
        // definitions: {
        //   path: join(process.cwd(), 'src/graphql.ts'), // Genera tipos TS
        //   outputAs: 'class',
        // },
        //autoSchemaFile: 'dist/graphqlSchema/schema.gql',
        resolvers: { JSON: new JsonScalar() },
        customScalarTypeMapping: { DateTime: 'Date' },

        //playground: playground(loggerService, configService),
        playground: true,
        // plugins: playground(loggerService, configService)
        //   ? [ApolloServerPluginLandingPageLocalDefault()]
        //   : [],
        introspection: introspection(loggerService, configService),
        cors: {
          credentials: true,
          origin: parseOriginFromEnvironment(),
        },
        formatError: (formattedError: GraphQLFormattedError, error: any) =>
          formatError(formattedError, error, loggerService),
        subscriptions: {
          'graphql-ws': {
            onConnect: (context: Context) => {
              const { connectionParams, extra } = context;
              const cookie = extractSubscriptionCookies({ extra });
              //loggerService.debug('Cookies', cookie);

              //TODO: Cambiar por el token de autenticación.
              const accessToken = cookie?.[AuthParameterKey.AccessToken];

              //loggerService.debug('Extract accessToken', { accessToken });

              if (!accessToken) {
                return false;
              }
              //accessToken =
              //  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInJvbGUiOlsiU1VQRVIiXSwiaWF0IjoxNjg2MTAwMjcxLCJleHAiOjE2ODYxMDM4NzF9.2pd4AGR1DhFXV2EY3f_Xpj2LbN0TEhUWTUQ49FoG-SY';
              //loggerService.debug('Conected', { context: extra });
              return ((extra as Record<string, string>)['accessToken'] =
                accessToken);
            },
            onDisconnect: (context: Context<any>, code, reason) => {
              // loggerService.debug('DisConected', {
              //   context,
              //   code: code,
              //   reason: reason,
              // });
            },

            onOperation(msg, params, socket: Socket) {},
          },
        },
        context: ({ req, res, extra }): unknown => context({ req, res, extra }),
      }),
    }),
  ],
  providers: [DateScalar, JsonScalar],
  exports: [],
})
export class GraphqlModule {}
