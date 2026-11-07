import {
  isPhoneNumber,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Móviles cubanos: +53 seguido de 5 o 6 y siete cifras. La librería de
 * teléfonos no conoce todos los tramos del 6 que va abriendo ETECSA.
 */
const CUBAN_MOBILE = /^\+53[56]\d{7}$/;

/** Teléfono internacional con código de país (`+5351234567`, `+5361234567`). */
export function isPhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const phone = value.replace(/[\s-]/g, '');
  return CUBAN_MOBILE.test(phone) || isPhoneNumber(phone);
}

/** Igual que `@IsPhoneNumber()`, pero acepta todos los móviles cubanos. */
export function IsPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isPhone(value),
        defaultMessage: () => `${propertyName} must be a valid phone number`,
      },
    });
  };
}
