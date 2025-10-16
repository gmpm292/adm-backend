/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SignRequestDto } from '../dto/sign-request.dto';
import { ConfigService } from '../../../common/config';

@Injectable()
export class QZTrayService implements OnModuleInit {
  private privateKey: string | undefined;
  private publicKey: string | undefined;
  private readonly logger = new Logger(QZTrayService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.privateKey = this.configService.get<string>('QZ_PRIVATE_KEY');
    this.publicKey = this.configService.get<string>('QZ_PUBLIC_KEY');

    if (!this.privateKey || !this.publicKey) {
      this.logger.error(
        'Error initializing QZTray module. QZ_PRIVATE_KEY and QZ_PUBLIC_KEY must be defined in environment variables',
      );
    } else {
      // Limpiar formato de las claves si es necesario
      this.privateKey = this.cleanPemFormat(this.privateKey, 'PRIVATE KEY');
      this.publicKey = this.cleanPemFormat(this.publicKey, 'CERTIFICATE');
    }
  }

  getPublicKey(): { publicKey: string } {
    return { publicKey: this.publicKey ?? '' };
  }

  signRequest(signRequestDto: SignRequestDto): string {
    try {
      const { request } = signRequestDto;

      if (!request) {
        throw new BadRequestException('Request string is required');
      }

      // Crear el signer (usando SHA1 como en tu ejemplo funcional)
      const signer = crypto.createSign('sha1');
      signer.update(request);

      // Firmar con la clave privada
      const signature = signer.sign(this.privateKey ?? '', 'base64');

      return signature;
    } catch (error) {
      console.error('❌ Error al firmar request:', error);
      throw new BadRequestException(`Error signing request: ${error.message}`);
    }
  }

  private cleanPemFormat(key: string, keyType: string): string {
    const pemHeader = `-----BEGIN ${keyType}-----`;
    const pemFooter = `-----END ${keyType}-----`;

    // Extraer solo el contenido base64 (sin headers)
    let content = key;
    if (key.includes(pemHeader) && key.includes(pemFooter)) {
      const startIdx = key.indexOf(pemHeader) + pemHeader.length;
      const endIdx = key.indexOf(pemFooter);
      content = key.slice(startIdx, endIdx);
    }

    // Limpiar completamente
    const cleanContent = content
      .trim()
      .replace(/\\n/g, '\n')
      .replace(/\s/g, '\n');

    return `${pemHeader}\n${cleanContent}\n${pemFooter}`;
  }
}
