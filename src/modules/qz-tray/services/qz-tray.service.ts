import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SignRequestDto } from '../dto/sign-request.dto';
import { ConfigService } from '../../../common/config';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';

/**
 * Firma de QZ Tray (impresión térmica). Las claves se leen en cada llamada:
 * un cambio en Configuración vale sin reiniciar.
 */
@Injectable()
export class QZTrayService {
  constructor(private configService: ConfigService) {}

  /** Certificado público para QZ Tray; vacío si no está configurado. */
  getPublicKey(): { publicKey: string } {
    const key = this.readKey('QZ_PUBLIC_KEY', 'CERTIFICATE');
    return { publicKey: key ?? '' };
  }

  /**
   * Firma en base64 la petición que manda QZ Tray desde el navegador. Lanza
   * 400 si no hay clave privada (o es la de ejemplo) o no es válida.
   */
  signRequest(signRequestDto: SignRequestDto): string {
    const { request } = signRequestDto;
    if (!request) {
      throw new BadRequestError('Falta la petición que hay que firmar');
    }
    const privateKey = this.readKey('QZ_PRIVATE_KEY', 'PRIVATE KEY');
    if (!privateKey) {
      throw new BadRequestError(
        'La impresión no está configurada: falta la clave privada de QZ Tray',
      );
    }
    try {
      // QZ Tray verifica la firma con SHA1
      return crypto
        .createSign('sha1')
        .update(request)
        .sign(privateKey, 'base64');
    } catch {
      throw new BadRequestError(
        'La clave privada de QZ Tray no es válida; revísala en Configuración',
      );
    }
  }

  /** La clave en formato PEM, o nada si falta o sigue la de ejemplo */
  private readKey(
    name: 'QZ_PRIVATE_KEY' | 'QZ_PUBLIC_KEY',
    keyType: string,
  ): string | undefined {
    const key = this.configService.get<string>(name);
    if (!key || key.includes('_AQUI')) return undefined;
    return this.cleanPemFormat(key, keyType);
  }

  /**
   * Rehace el PEM con cabecera y pie y un salto de línea entre cada tramo del
   * contenido: así vale una clave pegada en una sola línea desde
   * Configuración, con `\r\n` o con `\n` escritos como texto.
   */
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

    // `\n` literales a saltos; cada tramo de espacios (también `\r\n`) a un
    // solo salto, sin líneas vacías que el decodificador rechaza.
    const cleanContent = content
      .replace(/\\n/g, '\n')
      .trim()
      .split(/\s+/)
      .join('\n');

    return `${pemHeader}\n${cleanContent}\n${pemFooter}`;
  }
}
