/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-prototype-builtins */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { resolveFields, resolveFieldMap } from '@jenyus-org/graphql-utils';
import { plainToClass } from 'class-transformer';
import { validate, validateSync } from 'class-validator';
import { ListFilter } from '../models/list-filter.interface';
import 'reflect-metadata';
import { ListOptions } from '../models/list-options.interface';

export const Opts = createParamDecorator(
  async (
    data: { arg: string; dto?: any; class?: any },
    context: ExecutionContext,
  ) => {
    if (!data.arg) return null;
    const ctx: GqlExecutionContext = GqlExecutionContext.create(context);
    const info = ctx.getInfo();
    const requestedFields = resolveFields(info, true);
    const requestedFieldsMap = resolveFieldMap(info, true);
    let args = ctx.getArgs();
    if (Array.isArray(args)) {
      args = args.find((e) => e.hasOwnProperty(data.arg));
    }
    if (args && args.hasOwnProperty(data.arg)) {
      assertSafeListOptions(args[data.arg]);
      await validateFilters(data, args, requestedFields);

      // Validate obj ListOptions.
      const opts = plainToClass(ListOptions, {
        ...args[data.arg],
        requestedFields,
        requestedFieldsMap,
      });
      const errors = await validate(opts, {
        validationError: { target: false },
      });
      if (errors && errors.length > 0) {
        throw new BadRequestException(
          'Error validating the options list.',
          errors.toString(),
        );
      }

      return opts;
    }

    return null;
  },
);

async function validateFilters(
  data: { arg: string; dto?: any; class?: any },
  args: any,
  requestedFields: string[],
) {
  let keysNotAllowedByDto: string[] = [];
  let keysNotAllowedByClass: string[] = [];
  if (data.dto) {
    keysNotAllowedByDto = await validateWithDto(data, args);
  }
  if (data.class) {
    keysNotAllowedByClass = await validateWithClass(data, args);
  }
  let keysNotAllowed;
  if (data.dto && data.class) {
    keysNotAllowed = keysNotAllowedByDto.filter((item) =>
      keysNotAllowedByClass.includes(item),
    );
  } else if (data.dto || data.class) {
    keysNotAllowed = [...keysNotAllowedByDto, ...keysNotAllowedByClass];
  }

  if (keysNotAllowed.length > 0) {
    const queryName =
      requestedFields && requestedFields.length > 0 ? requestedFields[0] : null;
    throw new BadRequestException(
      `Query: ${queryName}. Fields not allowed in the filters: ${keysNotAllowed.join(
        ',',
      )}`,
    );
  }
}

async function validateWithDto(
  data: { arg: string; dto?: any; class?: any },
  args: any,
) {
  const keysNotAllowed: string[] = [];
  if (Array.isArray(args[data.arg].filters)) {
    const filters = args[data.arg].filters;
    let propsAndVals = extractPropsAndVals(filters);
    propsAndVals = plainToClass(data.dto, propsAndVals);
    const originalObj = structuredClone(propsAndVals);

    // Validate obj.
    const errors = await validate(propsAndVals, {
      skipMissingProperties: true,
      validationError: { target: false },
      whitelist: true,
    });
    if (errors && errors.length > 0) {
      throw new BadRequestException(
        'Some filters has failed the validation.',
        errors.toString(),
      );
    }
    // Get the fields not allowed in the filters.
    for (const key in originalObj) {
      if (!(key in propsAndVals)) keysNotAllowed.push(key);
    }
  }
  return keysNotAllowed;
}

async function validateWithClass(
  data: { arg: string; dto?: any; class?: any },
  args: any,
) {
  const keysNotAllowed: string[] = [];
  if (Array.isArray(args[data.arg].filters)) {
    const filters = args[data.arg].filters;
    let propsAndVals = extractPropsAndVals(filters);
    propsAndVals = plainToClass(data.class, propsAndVals);
    const originalObj = structuredClone(propsAndVals);

    // Validate obj.
    const errors = validateSync(propsAndVals, {
      skipMissingProperties: true,
      validationError: { target: false },
      whitelist: true,
    });
    if (errors && errors.length > 0) {
      throw new BadRequestException(
        'Some filters has failed the validation.',
        errors.toString(),
      );
    }
    // Get the fields not allowed in the filters.
    for (const key in originalObj) {
      if (!(key in propsAndVals)) keysNotAllowed.push(key);
    }
  }
  return keysNotAllowed;
}

// Un campo propio (`name`) o de una relación (`office.id`): nada de expresiones.
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

// Estos operadores escriben el valor tal cual en la consulta SQL. Los usan
// los servicios; de un cliente solo se admite `ANY` para agrupar filtros.
const RAW_OPERATORS = ['ANY', 'ANY_OPERATOR_AND_VALUE'];

// Columnas que no se filtran ni ordenan desde fuera: permitirían deducirlas.
const SECRET_FIELDS = [
  'password',
  'refreshtoken',
  'twofasecret',
  'confirmationtoken',
  'tokenvalue',
];

/**
 * Las opciones de listado llegan del cliente y acaban en la consulta SQL:
 * aquí se rechaza todo lo que no sea un campo y un valor.
 */
function assertSafeListOptions(options: any): void {
  const assertField = (property: unknown, where: string) => {
    const name = String(property);
    const lastPart = name.split('.').pop() as string;
    if (
      !FIELD_NAME.test(name) ||
      SECRET_FIELDS.includes(lastPart.toLowerCase())
    ) {
      throw new BadRequestException(`Field not allowed in the ${where}.`);
    }
  };

  const assertFilters = (filters: unknown) => {
    if (!Array.isArray(filters)) return;
    for (const filter of filters as ListFilter[]) {
      if (!filter) continue;
      if (filter.property) assertField(filter.property, 'filters');
      if (
        RAW_OPERATORS.includes(String(filter.operator)) &&
        (filter.property || filter.value)
      ) {
        throw new BadRequestException('Operator not allowed in the filters.');
      }
      assertFilters(filter.filters);
    }
  };

  assertFilters(options?.filters);

  if (Array.isArray(options?.sorts)) {
    for (const sort of options.sorts) {
      assertField(sort?.property, 'sorts');
    }
  }
}

function extractPropsAndVals(filts: ListFilter[]) {
  let propsAndVals = {};
  for (const { property, value, filters } of filts) {
    if (property) {
      propsAndVals = { ...propsAndVals, [property]: value };
    }
    if (filters) {
      propsAndVals = { ...propsAndVals, ...extractPropsAndVals(filters) };
    }
  }

  return propsAndVals;
}
