import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QZTrayResolver } from './resolvers/qz-tray.resolver';
import { QZTrayService } from './services/qz-tray.service';

@Module({
  imports: [ConfigModule],
  providers: [QZTrayResolver, QZTrayService],
  exports: [QZTrayResolver, QZTrayService],
})
export class QZTrayModule {}
