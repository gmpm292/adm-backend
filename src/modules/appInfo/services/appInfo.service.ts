/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';

/** Datos de la aplicación (de `package.json`). */
@Injectable()
export class AppInfoService {
  /** Nombre, versión y descripción; lee `package.json` en cada llamada. */
  public appInfo() {
    const { name, version, description } = JSON.parse(
      readFileSync('package.json', 'utf8'),
    );
    return {
      name,
      version,
      description,
    };
  }
}
