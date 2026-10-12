import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { getDatabaseConnection } from '../../common/config/helpers/connection.helper';

config();

const configService = new ConfigService();

const dataSource = new DataSource({
  type: 'postgres',
  ...getDatabaseConnection((key) => configService.get<string>(key)),
  synchronize: false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
export default dataSource;
