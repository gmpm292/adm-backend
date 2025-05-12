import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { parseOriginFromEnvironment } from './common/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //Enable Cors in the App
  app.enableCors({
    credentials: true,
    origin: parseOriginFromEnvironment(),
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
