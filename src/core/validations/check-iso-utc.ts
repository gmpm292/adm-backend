import {
  isDate,
  isISO8601,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export function CheckIsIsoUTCDate(validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      name: 'CheckIsIsoUTCDate',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions ?? {
        message: `The date ${propertyName} must be in ISO8601 and UTC zone !!`,
      },
      validator: {
        validate(value: any) {
          const beginWithDate = () => {
            const regex =
              /^(\d{4}-\d{2}-\d{2})|(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)?\d{2}/;
            return regex.test(value);
          };
          //console.log('valor ', new Date(value));
          if (
            value?.length > 6 &&
            (isISO8601(value) || isDate(value) || beginWithDate())
          ) {
            const date = new Date(value);
            // Validar formato de fecha
            if (!isFinite(date.getTime())) {
              return false;
            }
            return value === date.toISOString();
          }

          return true;
        },
      },
    });
  };
}
