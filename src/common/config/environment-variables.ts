import { IsNotEmpty, IsOptional } from 'class-validator';
import { Environment } from './enums/environment.enum';

export class EnvironmentVariables {
  ////.ENV //////////////////////////////////////////////////////////////
  // DATABASE
  @IsNotEmpty()
  public TYPEORM_HOST: string;
  @IsNotEmpty()
  public TYPEORM_PORT: number;
  @IsNotEmpty()
  public TYPEORM_USERNAME: string;
  @IsNotEmpty()
  public TYPEORM_PASSWORD: string;
  @IsNotEmpty()
  public TYPEORM_DATABASE: string;
  @IsOptional()
  public SSL_CERT: string;

  // SECURITY
  @IsNotEmpty()
  public ACCESS_TOKEN_SECRET: string;
  @IsNotEmpty()
  public REFRESH_TOKEN_SECRET: string;
  // Origins allowed to query the API. To insert multiple values separate by comma (,) to allow any origin set (*)
  @IsNotEmpty()
  public CORS_ORIGIN: string;

  // SYSTEM
  //possible environments: 'development', 'production','test'
  @IsNotEmpty()
  public NODE_ENV: Environment;
  @IsNotEmpty()
  public PORT: number;

  //CACHE
  @IsNotEmpty()
  public CACHE_REDIS_HOST: string;
  @IsNotEmpty()
  public CACHE_REDIS_PORT: string;
  @IsOptional()
  public CACHE_REDIS_PASSWORD: string;

  //SUBSCRIPTIONS
  @IsNotEmpty()
  public SUBSCRIPTION_REDIS_HOST: string;
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

  ////Backend Configurations //////////////////////////////////////////////////////////////
}
