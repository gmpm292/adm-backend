import { Injectable } from '@nestjs/common';

/** Servicio de la ruta raíz (`GET /`): solo responde un saludo. */
@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to adm-backend!';
  }
}
