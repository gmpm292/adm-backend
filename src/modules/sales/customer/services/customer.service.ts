import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
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
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { SaleService } from '../../sale/services/sale.service';
import { UsersService } from '../../../users/services/users.service';

@Injectable()
export class CustomerService extends BaseService<Customer> {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private userService: UsersService,
    @Inject(forwardRef(() => SaleService))
    private saleService: SaleService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(customerRepository);
  }

  async create(
    createCustomerInput: CreateCustomerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Customer> {
    const customer: Customer = {
      ...createCustomerInput,
    } as Customer;

    if (createCustomerInput.userId) {
      const user = await this.userService.findOne(
        createCustomerInput.userId,
        undefined,
        cu,
        scopes,
        manager,
      );
      if (!user) {
        throw new NotFoundError('User not found');
      }
      customer.user = user;
    }

    return super.baseCreate({
      data: customer,
      uniqueFields: ['email', 'phone'],
      cu,
      scopes,
      manager,
    });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: ['user', 'sales', 'business', 'office'],
      cu,
      scopes,
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
        sales: true,
        business: true,
        office: true,
      },
      cu,
      scopes,
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
    const customer = await super.baseFindOne({ id, cu, scopes, manager });
    if (!customer) {
      throw new NotFoundError();
    }

    if (updateCustomerInput.userId) {
      const user = await this.userService.findOne(
        updateCustomerInput.userId,
        undefined,
        cu,
        scopes,
        manager,
      );
      if (!user) {
        throw new NotFoundError('User not found');
      }
      customer.user = user;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId, ...rest } = updateCustomerInput;
    return super.baseUpdate({
      id,
      data: { ...customer, ...rest },
      cu,
      scopes,
      manager,
    });
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Customer[]> {
    const customers = await super.baseFindByIds({
      ids,
      relationsToLoad: { sales: true },
      cu,
      scopes,
      manager,
    });

    if (customers.length === 0) {
      throw new NotFoundError('No customers found.');
    }

    await Promise.all(
      customers.map((customer) =>
        customer.sales?.length
          ? this.saleService.remove(
              customer.sales.map((s) => s.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

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

    const customers = await super.baseFindByIds({
      ids,
      relationsToLoad: { sales: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedCustomers = customers.filter((c) => c.deletedAt);
    if (deletedCustomers.length === 0) return 0;

    await Promise.all(
      deletedCustomers.map((customer) =>
        customer.sales?.length
          ? this.saleService.restore(
              customer.sales
                .filter((s) => s.deletedAt)
                .map((s) => s.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedCustomers.map((c) => c.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
