import { Injectable } from '@nestjs/common';
import { EntityManager, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCustomerInput } from '../dto/create-customer.input';
import { UpdateCustomerInput } from '../dto/update-customer.input';
import { BaseService } from '../../../../core/services/base.service';
import { Customer } from '../entities/customer.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { UsersService } from '../../../users/services/users.service';
import { SALE_SCOPES } from '../../sale/helpers/sale-scopes';

// Datos que identifican a una persona: no se repiten dentro de una empresa.
const UNIQUE_FIELDS = [
  { field: 'phone', label: 'ese teléfono' },
  { field: 'email', label: 'ese correo' },
  { field: 'ci', label: 'ese carné de identidad' },
] as const;

@Injectable()
export class CustomerService extends BaseService<Customer> {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private userService: UsersService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(customerRepository);
  }

  // Los clientes son de la tienda, igual que sus ventas.
  private scopesFor(cu?: JWTPayload, scopes?: ScopedAccessEnum[]) {
    return scopes ?? this.scopedAccessService.scopesOrDefault(cu, SALE_SCOPES);
  }

  private generateFullName(name: string, lastName?: string | null): string {
    return [name, lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
  }

  async create(
    createCustomerInput: CreateCustomerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Customer> {
    scopes = this.scopesFor(cu, scopes);
    const { userId, ...input } = createCustomerInput;

    const customer = {
      ...input,
      name: input.name.trim(),
      lastName: input.lastName?.trim() || null,
      fullName: this.generateFullName(input.name, input.lastName),
      ci: input.ci?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone || null,
      loyaltyPoints: input.loyaltyPoints || 0,
    } as unknown as Customer;

    await this.assertUnique(
      customer,
      createCustomerInput.businessId,
      undefined,
      manager,
    );

    if (userId) {
      customer.user = await this.userService.findOne(
        userId,
        undefined,
        cu,
        scopes,
        manager,
      );
    }

    const created = await super.baseCreate({
      data: customer,
      cu,
      scopes,
      manager,
    });
    return this.findOne(created.id as number, cu, scopes, manager);
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    // Sin las ventas: un listado no debe arrastrar el historial de cada cliente.
    return await super.baseFind({
      options,
      relationsToLoad: ['user', 'business', 'office'],
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Customer> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        user: true,
        business: true,
        office: true,
        department: true,
        team: true,
        createdBy: true,
        updatedBy: true,
      },
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });
  }

  async update(
    id: number,
    updateCustomerInput: UpdateCustomerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Customer> {
    scopes = this.scopesFor(cu, scopes);
    const customer = await this.findOne(id, cu, scopes, manager);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId, id: _id, ...input } = updateCustomerInput;
    const data: Partial<Customer> = { ...input } as Partial<Customer>;

    // `null` o una cadena vacía borran el dato opcional.
    if (input.name !== undefined) data.name = input.name.trim();
    for (const field of ['lastName', 'ci', 'phone'] as const) {
      if (input[field] !== undefined) {
        data[field] = input[field]?.trim() || (null as unknown as undefined);
      }
    }
    if (input.email !== undefined) {
      data.email =
        input.email?.trim().toLowerCase() || (null as unknown as undefined);
    }

    data.fullName = this.generateFullName(
      data.name ?? customer.name,
      data.lastName !== undefined ? data.lastName : customer.lastName,
    );

    await this.assertUnique(
      data,
      input.businessId ?? (customer.business?.id as number),
      id,
      manager,
    );

    if (userId) {
      data.user = await this.userService.findOne(
        userId,
        undefined,
        cu,
        scopes,
        manager,
      );
    }

    await super.baseUpdate({ id, data, cu, scopes, manager });
    return this.findOne(id, cu, scopes, manager);
  }

  /**
   * Da de baja a los clientes. Sus ventas se conservan: son el registro de lo
   * vendido y cobrado.
   */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Customer[]> {
    scopes = this.scopesFor(cu, scopes);
    const customers = await super.baseFindByIds({ ids, cu, scopes, manager });

    if (customers.length === 0) {
      throw new NotFoundError('Cliente no encontrado');
    }

    return super.baseDeleteMany({
      ids: customers.map((c) => c.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;
    scopes = this.scopesFor(cu, scopes);

    const customers = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedCustomers = customers.filter((c) => c.deletedAt);
    if (deletedCustomers.length === 0) return 0;

    return super.baseRestoreDeletedMany({
      ids: deletedCustomers.map((c) => c.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }

  private async assertUnique(
    data: Partial<Customer>,
    businessId: number | undefined,
    exceptId?: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(Customer) ?? this.customerRepository;

    for (const { field, label } of UNIQUE_FIELDS) {
      const value = data[field];
      if (!value) continue;

      const existing = await repository.findOne({
        where: {
          [field]: value,
          ...(businessId && { business: { id: businessId } }),
          ...(exceptId && { id: Not(exceptId) }),
        },
      });
      if (existing) {
        throw new ConflictError(
          `Ya hay un cliente con ${label}: ${existing.fullName ?? existing.name}`,
        );
      }
    }
  }
}
