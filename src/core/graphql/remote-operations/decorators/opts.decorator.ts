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
