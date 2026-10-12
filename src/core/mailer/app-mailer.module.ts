import { Global, Module } from '@nestjs/common';
import { IAppMailer } from './app-mailer.interface';
import { AppMailerService } from './app-mailer.service';
import { EmailModule } from '../../modules/email/email.module';

@Global()
@Module({
  imports: [EmailModule],
  providers: [
    {
      provide: IAppMailer,
      useClass: AppMailerService,
    },
  ],
  exports: [IAppMailer],
})
export class AppMailerModule {}
