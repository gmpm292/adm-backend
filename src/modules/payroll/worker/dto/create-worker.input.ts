import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsPositive,
  IsInt,
  IsEmail,
  IsPhoneNumber,
  IsArray,
} from 'class-validator';
import { WorkerType } from '../enums/worker-type.enum';
import { Role } from '../../../../core/enums/role.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';

export class CreateWorkerInput extends CreateSecurityBaseInput {
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @IsEnum(WorkerType)
  workerType: WorkerType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  paymentRuleId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  baseSalary?: number;

  @IsOptional()
  customPaymentSettings?: Record<string, unknown>;

  // Campos temporales para creación de usuario
  @IsOptional()
  @IsString()
  tempFirstName?: string;

  @IsOptional()
  @IsString()
  tempLastName?: string;

  @IsOptional()
  @IsEmail()
  tempEmail?: string;

  @IsOptional()
  @IsPhoneNumber()
  tempPhone?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  tempRole?: Role[];

  async validateCustomRules(currentUser: JWTPayload): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await this.checkWorkerInformation(currentUser);
  }

  private checkWorkerInformation(currentUser: { role: Role[] }): void {
    if (this.role === Role.SUPER) {
      throw new BadRequestError('A worker cannot have a SUPER role.');
    }
    if (this.role === Role.PRINCIPAL) {
      if (this.officeId || this.departmentId || this.teamId) {
        throw new BadRequestError(
          'PRINCIPAL cannot have office, department or team',
        );
      }
    }
    if (this.role === Role.ADMIN) {
      if (!this.officeId) {
        throw new BadRequestError('The administrator has no office');
      }
      if (this.departmentId || this.teamId) {
        throw new BadRequestError(
          'The administrator cannot have a department or team',
        );
      }
    }
    if (this.role === Role.MANAGER) {
      if (!this.officeId || !this.departmentId) {
        throw new BadRequestError('The manager has no office or department');
      }
      if (this.teamId) {
        throw new BadRequestError('The manager cannot have a team');
      }
    }
    if (
      this.role === Role.SUPERVISOR &&
      (!this.officeId || !this.departmentId || !this.teamId)
    ) {
      throw new BadRequestError(
        'The supervisor has no office, department or team',
      );
    }
    if (
      this.role === Role.AGENT &&
      (!this.officeId || !this.departmentId || !this.teamId)
    ) {
      throw new BadRequestError('The agent has no office, department or team');
    }

    // Check that a role cannot create a higher one
    if (currentUser.role.some((r) => r === Role.ADMIN)) {
      if (this.role === Role.PRINCIPAL || this.role === Role.ADMIN) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
    if (currentUser.role.some((r) => r === Role.MANAGER)) {
      if (
        this.role === Role.PRINCIPAL ||
        this.role === Role.ADMIN ||
        this.role === Role.MANAGER
      ) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
    if (currentUser.role.some((r) => r === Role.SUPERVISOR)) {
      if (
        this.role === Role.PRINCIPAL ||
        this.role === Role.ADMIN ||
        this.role === Role.MANAGER ||
        this.role === Role.SUPERVISOR
      ) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
    if (currentUser.role.some((r) => r === Role.AGENT)) {
      if (
        this.role === Role.PRINCIPAL ||
        this.role === Role.ADMIN ||
        this.role === Role.MANAGER ||
        this.role === Role.SUPERVISOR ||
        this.role === Role.AGENT
      ) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
  }
}
