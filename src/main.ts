import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { parseOriginFromEnvironment } from './common/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //Enable Cors in the App
  app.enableCors({
    credentials: true,
    origin: parseOriginFromEnvironment(),
  });

  // Add helmet in production
  // if (configService.get('SECURITY_ENV') === Environment.Production) {
  //   app.use(helmet());
  // }

  // app.useLogger(app.get(AppLoggerService));

  // Set Request Size Limit
  // app.use(bodyParser.json({ limit: '10mb' }));
  // app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // Use Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      //whitelist: true,
      //forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
