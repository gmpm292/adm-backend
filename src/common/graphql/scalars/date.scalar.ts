/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { isISO8601 } from 'class-validator';
import { Kind, ValueNode } from 'graphql';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../core/errors/appErrors/ConflictError.error';

@Scalar('Date', () => Date)
export class DateScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type';

  parseValue(value: string): Date {
    this.validate(value);
    return new Date(value);
    // value from the client
  }

  serialize(value: Date): string {
    try {
      return new Date(value).toISOString();
    } catch (e) {
      e;
      throw new ConflictError(
        `value: ${value} canot be converted to iso string`,
      );
    }
    // value sent to the client
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING) {
      this.validate(ast.value);
      return new Date(ast.value);
    }
    throw new BadRequestError('Invalid date format');
  }

  private validate(value: any) {
    let valid = true;
    let date;
    valid = isISO8601(value, { strict: true });
    valid ? (date = new Date(value)) : null;
    valid = isFinite(date?.getTime()) && value == date.toISOString();
    if (!valid) {
      throw new BadRequestError(
        `The date ${value} must be in ISO8601 and UTC zone !!`,
      );
    }
  }
}
