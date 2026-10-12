import { Injectable } from '@nestjs/common';

/** Base común (vacía) de los procesadores de cada tipo de regla de pago. */
@Injectable()
export abstract class BasePaymentProcessor {}
