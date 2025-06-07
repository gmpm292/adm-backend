import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailSentService } from './email-sent.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSent } from '../../entities';
@Module({
  imports: [
    TypeOrmModule.forFeature([EmailSent]),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const setup = config.get<MailerOptions>('email_config');
        //console.log(setup);
        return setup;
      },
    }),
  ],
  providers: [EmailSentService],
  exports: [EmailSentService],
})
export class AppMailerModule {}
