import { Request } from 'express';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
/**
 * Devuelve la primera variable de la petición GraphQL (`body.variables`),
 * sea cual sea el nombre que le dio el cliente. Sin variables lanza 400.
 */
export function getQueryArgumentsFromRequest<T>(request: Request): T {
  // the query arguments come inside the property defined by the client in their query
  const clientQueryInputVar = Object.keys(request.body?.variables ?? {});

  if (clientQueryInputVar.length === 0) {
    throw new BadRequestError('No query arguments found');
  }

  return request.body.variables[clientQueryInputVar[0]];
}
