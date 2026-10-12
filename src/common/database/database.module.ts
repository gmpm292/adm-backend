import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { getDatabaseConnection } from '../config/helpers/connection.helper';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const bd: TypeOrmModuleOptions = {
          type: 'postgres',
          ...getDatabaseConnection((key) => configService.get<string>(key)),

          entities: ['dist/**/*.entity{.ts,.js}'],
          subscribers: ['dist/**/*.subscriber{.ts,.js}'],
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
