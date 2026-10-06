import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateSaleInput } from '../dto/create-sale.input';
import { UpdateSaleInput } from '../dto/update-sale.input';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';
import { SaleService } from '../services/sale.service';
import { SaleCatalogService } from '../services/sale-catalog.service';
import { SaleFiltersValidator } from '../filters-validator/sale-filters.validator';
import { MakeSaleInput } from '../dto/make-sale.input';
import { ValidateSalePaymentsInput } from '../dto/validate-sale-payments.input';
import { SalePaymentValidationResponse } from '../types/sale-payment-validation.response';
import { RefundSaleInput } from '../dto/refund-sale.input';
import { QuoteSaleInput } from '../dto/quote-sale.input';

// Quien atiende al público: vende, cobra y consulta sus ventas.
const SELLING_ROLES = [
  Role.SUPER,
  Role.PRINCIPAL,
  Role.ADMIN,
  Role.MANAGER,
  Role.SUPERVISOR,
  Role.AGENT,
];

@Resolver('Sale')
export class SaleResolver {
  constructor(
    private readonly saleService: SaleService,
    private readonly saleCatalogService: SaleCatalogService,
  ) {}

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createSale')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createSaleInput') createSaleInput: CreateSaleInput,
  ) {
    return this.saleService.create(createSaleInput, user);
  }

  // Un vendedor sin mando solo recibe sus propias ventas (SaleService).
  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('sales')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: SaleFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.saleService.find(options, user);
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('sale')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.saleService.findOne(id, user);
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('salesByCustomer')
  async findByCustomer(
    @CurrentUser() user: JWTPayload,
    @Args('customerId') customerId: number,
  ) {
    return this.saleService.findByCustomer(customerId, user);
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('saleCatalog')
  async saleCatalog(
    @CurrentUser() user: JWTPayload,
    @Args('officeId') officeId?: number,
  ) {
    return this.saleCatalogService.getCatalog(user, officeId);
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('quoteSale')
  async quoteSale(
    @CurrentUser() user: JWTPayload,
    @Args('quoteSaleInput') quoteSaleInput: QuoteSaleInput,
  ) {
    return this.saleService.quote(quoteSaleInput, user);
  }

  // Los datos generales de un borrador (cliente, mensajería) los completa
  // quien lo atiende; el servicio impide tocar una venta ya cobrada.
  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateSale')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateSaleInput') updateSaleInput: UpdateSaleInput,
  ) {
    return this.saleService.update(updateSaleInput.id, updateSaleInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeSales')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.saleService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreSales')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.saleService.restore(ids, user);
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('makeSale')
  async makeSale(
    @CurrentUser() user: JWTPayload,
    @Args('makeSaleInput') makeSaleInput: MakeSaleInput,
  ) {
    return this.saleService.makeSale(
      makeSaleInput.saleId,
      makeSaleInput.payments,
      makeSaleInput.baseCurrency,
      makeSaleInput.customDate,
      user,
    );
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('cancelSale')
  async cancelSale(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.saleService.cancelSale(id, user);
  }

  @Roles(...SELLING_ROLES)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('validateSalePayments')
  async validateSalePayments(
    @CurrentUser() user: JWTPayload,
    @Args('validateSalePaymentsInput')
    validateSalePaymentsInput: ValidateSalePaymentsInput,
  ): Promise<SalePaymentValidationResponse> {
    // Primero obtener la venta para acceder a sus detalles
    const sale = await this.saleService.findOne(
      validateSalePaymentsInput.saleId,
      user,
    );

    return this.saleService.validateSalePayments(
      sale.details ?? [],
      validateSalePaymentsInput.payments,
      validateSalePaymentsInput.baseCurrency,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('refundSale')
  async refundSale(
    @CurrentUser() user: JWTPayload,
    @Args('refundSaleInput') refundSaleInput: RefundSaleInput,
  ) {
    return this.saleService.refundSale(refundSaleInput, user);
  }
}
