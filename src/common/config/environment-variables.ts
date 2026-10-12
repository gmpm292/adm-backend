import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { Environment } from './enums/environment.enum';

/**
 * Variables de configuración. Las del bloque `.ENV` se validan al arrancar
 * (`validate.helper`); las de «Backend Configurations» viven en la tabla
 * `config` y aquí solo dan nombre y tipo a sus claves.
 */
export class EnvironmentVariables {
  ////.ENV //////////////////////////////////////////////////////////////
  // DATABASE
  // En Heroku manda DATABASE_URL (la actualiza el add-on); las TYPEORM_* son
  // para local y solo se exigen sin ella.
  @IsOptional()
  public DATABASE_URL: string;
  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsNotEmpty()
  public TYPEORM_HOST: string;
  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsNotEmpty()
  public TYPEORM_PORT: number;
  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsNotEmpty()
  public TYPEORM_USERNAME: string;
  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsNotEmpty()
  public TYPEORM_PASSWORD: string;
  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsNotEmpty()
  public TYPEORM_DATABASE: string;

  // SECURITY
  @IsNotEmpty()
  public ACCESS_TOKEN_SECRET: string;
  @IsNotEmpty()
  public REFRESH_TOKEN_SECRET: string;
  // Orígenes que pueden consultar la API, separados por comas; `*` acepta
  // cualquiera.
  @IsNotEmpty()
  public CORS_ORIGIN: string;

  // SYSTEM
  //possible environments: 'development', 'production','test'
  @IsNotEmpty()
  public NODE_ENV: Environment;
  @IsNotEmpty()
  public PORT: number;

  // REDIS
  // En Heroku manda REDIS_URL (la actualiza el add-on); las CACHE_* y
  // SUBSCRIPTION_* son para local y solo se exigen sin ella.
  @IsOptional()
  public REDIS_URL: string;

  //CACHE
  @ValidateIf((env: EnvironmentVariables) => !env.REDIS_URL)
  @IsNotEmpty()
  public CACHE_REDIS_HOST: string;
  @ValidateIf((env: EnvironmentVariables) => !env.REDIS_URL)
  @IsNotEmpty()
  public CACHE_REDIS_PORT: string;
  @IsOptional()
  public CACHE_REDIS_PASSWORD: string;

  //SUBSCRIPTIONS
  @ValidateIf((env: EnvironmentVariables) => !env.REDIS_URL)
  @IsNotEmpty()
  public SUBSCRIPTION_REDIS_HOST: string;
  @ValidateIf((env: EnvironmentVariables) => !env.REDIS_URL)
  @IsNotEmpty()
  public SUBSCRIPTION_REDIS_PORT: string;
  @IsOptional()
  public SUBSCRIPTION_REDIS_PASSWORD: string;

  ////.ENV //////////////////////////////////////////////////////////////

  ////Backend Configurations //////////////////////////////////////////////////////////////

  //FRONTEND_URLs
  FRONTEND_BASE_URL: string;
  FRONTEND_CHANGE_PASSWORD_URL: string;

  //SECURITY_JWT
  ACCESS_TOKEN_EXPIRE_IN: string;
  REFRESH_TOKEN_EXPIRE_IN: string;
  CONFIRMATION_TOKEN_EXPIRE_IN: string;

  //Logs
  DAYS_TO_PRESERVE_LOGS: string;

  // Email
  //// Configuración básica
  EMAIL_PROVIDER: string;
  FROM: string;
  FROM_EMAIL: string;
  EMAIL_USER: string;
  TEMPLATE_DIR: string;
  EMAIL_TEST_ON_STARTUP: boolean;
  EMAIL_TEST_RECIPIENT: string;
  ENCRYPTION_KEY: string;
  //// Configuración SMTP
  EMAIL_HOST: string;
  EMAIL_PORT: string;
  EMAIL_PASSWORD: string;
  EMAIL_SECURE: string;
  //// Configuración OAuth2 (Google)
  EMAIL_CLIENT_ID: string;
  EMAIL_SECRET_KEY: string;
  EMAIL_REDIRECT_URI: string;
  EMAIL_REFRESH_TOKEN: string;
  EMAIL_SERVICE: string;
  //// Configuración de plantillas

  // Telegram
  //// Configuración de Telegram_BOTS
  TELEGRAM_BOTS: string;
  //// Configuración de Telegram_API
  TELEGRAM_API_ID: string;
  TELEGRAM_API_HASH: string;
  TELEGRAM_SESSION: string;
  //// Configuración de Telegram_WEBHOOKS
  TELEGRAM_WEBHOOK_URL: string;
  TELEGRAM_SECRET_TOKEN: string;

  // QZ Tray Configuration
  QZ_PRIVATE_KEY: string;
  QZ_PUBLIC_KEY: string;
}
