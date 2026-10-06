import {
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ILike,
  Not,
  ObjectLiteral,
} from 'typeorm';
import { ConflictError } from '../../../core/errors/appErrors/ConflictError.error';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';

/** Algo que cuelga de una unidad de la empresa e impide eliminarla. */
export type Dependents<Entity extends ObjectLiteral = ObjectLiteral> = {
  entity: EntityTarget<Entity>;
  where: (id: number) => FindOptionsWhere<Entity>;
  /** Cómo nombrarlos en el mensaje: «2 oficinas». */
  label: (count: number) => string;
};

/**
 * Una empresa, oficina, departamento o equipo solo se elimina cuando está
 * vacío. Eliminarlo no arrastra a su gente ni a lo que cuelga de él: quien lo
 * hace tiene que moverlo o eliminarlo antes, a sabiendas.
 */
export async function assertNotInUse(
  manager: EntityManager,
  units: Array<{ id?: number; name?: string }>,
  dependents: Dependents[],
): Promise<void> {
  for (const unit of units) {
    const found: string[] = [];
    for (const { entity, where, label } of dependents) {
      const count = await manager.count(entity, {
        where: where(unit.id as number),
      });
      if (count > 0) found.push(label(count));
    }
    if (found.length > 0) {
      throw new ConflictError(
        `No se puede eliminar "${unit.name}": tiene ${found.join(' y ')}. Muévelos o elimínalos primero.`,
      );
    }
  }
}

/** Dentro de un mismo nivel superior no se repite el nombre. */
export async function assertUniqueName<Entity extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<Entity>,
  name: string,
  scope: FindOptionsWhere<Entity>,
  message: string,
  exceptId?: number,
): Promise<void> {
  const existing = await manager.findOne(entity, {
    where: {
      ...scope,
      name: ILike(name.replace(/[%_\\]/g, '\\$&')),
      ...(exceptId && { id: Not(exceptId) }),
    } as FindOptionsWhere<Entity>,
  });
  if (existing) throw new ConflictError(message);
}

/** Nombre sin espacios sobrantes; vacío no vale. */
export function cleanName(name: string | undefined | null): string {
  const clean = (name ?? '').trim();
  if (!clean) throw new BadRequestError('El nombre es obligatorio');
  return clean;
}

/** Texto opcional: sin espacios sobrantes y `null` si queda vacío. */
export function cleanText(value: string | undefined | null): string | null {
  return value?.trim() || null;
}

export const plural = (singular: string, pluralForm: string) => (n: number) =>
  `${n} ${n === 1 ? singular : pluralForm}`;
