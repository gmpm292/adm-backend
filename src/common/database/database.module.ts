import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { isRemote } from './helpers/isDBRemote.helper';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const bd: TypeOrmModuleOptions = {
          type: 'postgres',
          host: configService.get<string>('TYPEORM_HOST'),
          port: configService.get<number>('TYPEORM_PORT'),
          username: configService.get<string>('TYPEORM_USERNAME'),
          password: configService.get<string>('TYPEORM_PASSWORD'),
          database: configService.get<string>('TYPEORM_DATABASE'),
          ssl: isRemote()
            ? { ca: configService.get<string>('SSL_CERT') }
            : false,

          entities: ['dist/**/*.entity{.ts,.js}'],
          migrationsTableName: 'migrations',
          migrations: ['dist/migrations/*.js'],

          logger: 'simple-console',
          logging: ['migration'],
          migrationsRun: true,
          autoLoadEntities: true,
          synchronize: false,
        };
        return bd;
      },

      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
