import { Config } from '../entities/config.entity';
import { ConfigStatus } from '../enums/config-status.enum';
import { ConfigVisibility } from '../enums/config-visibility.enum';
import { ConfigCategory } from '../enums/config-category.enum';

export const backendConfigurations: Array<Config> = [
  {
    category: ConfigCategory.FRONTEND,
    group: 'FRONTEND_URLs',
    description: 'URLs de frontend para diferentes propósitos',
    values: {
      FRONTEND_BASE_URL: 'https://example.pro',
      FRONTEND_CHANGE_PASSWORD_URL: 'https://example.pro/auth/change-password',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.ENABLED,
  },

  {
    category: ConfigCategory.FRONTEND,
    group: 'QZ_Tray_Configuration',
    description:
      'Configuración de las claves pública y privada de los agentes QZ_Tray',
    values: {
      QZ_PRIVATE_KEY:
        '-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----',
      QZ_PUBLIC_KEY:
        '-----BEGIN CERTIFICATE-----\nTU_CERTIFICADO_PUBLICO_AQUI\n-----END CERTIFICATE-----',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.ENABLED,
  },

  {
    category: ConfigCategory.SECURITY,
    group: 'SECURITY_JWT',
    description: 'Configuraciones de seguridad JWT',
    values: {
      ACCESS_TOKEN_EXPIRE_IN: '300',
      REFRESH_TOKEN_EXPIRE_IN: '14400',
      CONFIRMATION_TOKEN_EXPIRE_IN: '360000',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.ENABLED,
  },

  {
    category: ConfigCategory.SYSTEM,
    group: 'Logs',
    description: 'Configuraciones de logs del sistema',
    values: {
      DAYS_TO_PRESERVE_LOGS: '30',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.ENABLED,
  },

  {
    category: ConfigCategory.GENERAL,
    group: 'Email-General',
    description: 'Configuraciones de email del sistema',
    values: {
      EMAIL_PROVIDER: 'gmail_oauth2',
      FROM: 'Nombre de tu aplicación',
      FROM_EMAIL: 'no-reply@tudominio.com',
      EMAIL_USER: 'tu_usuario_de_configuracion_google_console',
      TEMPLATE_DIR: '/templates/email',
      EMAIL_TEST_ON_STARTUP: false,
      EMAIL_TEST_RECIPIENT: 'tu-email@example.com',
      ENCRYPTION_KEY: 'default-key-32-chars-long-need',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.DISABLED,
  },

  {
    category: ConfigCategory.GENERAL,
    group: 'Email-OAuth2',
    description: 'Configuraciones de transporte de email del sistema',
    values: {
      EMAIL_CLIENT_ID: 'tu_client_id',
      EMAIL_SECRET_KEY: 'tu_secret_key',
      EMAIL_REDIRECT_URI: 'tu_redirect_uri',
      EMAIL_REFRESH_TOKEN: 'tu_refresh_token',
      EMAIL_SERVICE: 'gmail',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.DISABLED,
  },

  {
    category: ConfigCategory.GENERAL,
    group: 'Email-SMTP',
    description: 'Configuraciones de transporte de email del sistema',
    values: {
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_PORT: 587,
      EMAIL_PASSWOR: 'tu_contraseña',
      EMAIL_SECURE: false,
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.DISABLED,
  },

  {
    category: ConfigCategory.GENERAL,
    group: 'Telegram-API',
    description: 'Configuraciones de transporte de email del sistema',
    values: {
      TELEGRAM_API_ID: 123456,
      TELEGRAM_API_HASH: 'your_api_hash_here',
      TELEGRAM_SESSION: 'your_session_string_here',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.DISABLED,
  },

  {
    category: ConfigCategory.GENERAL,
    group: 'Telegram-Bots',
    description: 'Configuraciones de transporte de email del sistema',
    values: {
      TELEGRAM_BOTS:
        '{"default":"123456789:AAEXAMPLEBOTTOKEN","notifications":"987654321:AAOTHERBOTTOKEN","support":"567891234:AASUPPORTBOTTOKEN"}',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.DISABLED,
  },

  {
    category: ConfigCategory.GENERAL,
    group: 'Telegram-WEBHOOK',
    description: 'Configuraciones de transporte de email del sistema',
    values: {
      TELEGRAM_WEBHOOK_URL: 'https://url-app-backend.com',
      TELEGRAM_SECRET_TOKEN: 'tu_token_secreto',
    },
    configVisibility: ConfigVisibility.PRIVATE,
    configStatus: ConfigStatus.DISABLED,
  },
];
