import {
  isISO8601,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export function IsIsoUTCDate(validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      name: 'IsIsoUTCDate',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions ?? {
        message: `The date ${propertyName} must be in ISO8601 and UTC zone !!`,
      },
      validator: {
        validate(value: any) {
          if (!isISO8601(value)) {
            return false;
          }
          const date = new Date(value);

          if (!isFinite(date.getTime())) {
            return false;
          }
          return value === date.toISOString();
        },
      },
    });
  };
}
