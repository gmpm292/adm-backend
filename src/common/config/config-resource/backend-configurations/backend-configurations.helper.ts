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
];
