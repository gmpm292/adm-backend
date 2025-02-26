import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
//import { isRemote } from '@app/common/database/helpers/isDBRemote.helper';

config();

const configService = new ConfigService();

const dataSource = new DataSource({
  type: 'postgres',
  host: configService.get('TYPEORM_HOST'),
  port: configService.get<number>('TYPEORM_PORT'),
  username: configService.get('TYPEORM_USERNAME'),
  password: configService.get('TYPEORM_PASSWORD'),
  database: configService.get('TYPEORM_DATABASE'),
  synchronize: false,
  //ssl: isRemote() ? { ca: configService.get('SSL_CERT') } : false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
export default dataSource;
