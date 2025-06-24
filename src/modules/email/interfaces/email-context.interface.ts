export abstract class EmailContext {
  // Campos comunes para todas las plantillas
  appName?: string;
  userName?: string;
  verifyUrl?: string;
  resetUrl?: string;
  sentByUserId?: string;

  // Permite campos adicionales dinámicos
  [key: string]: any;
}
