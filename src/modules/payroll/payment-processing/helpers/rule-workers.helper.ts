import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { Worker } from '../../worker/entities/worker.entity';

/**
 * Los trabajadores que la regla limita con `specificWorkers`; si la lista
 * está vacía la regla vale para todos los de su tipo y no se filtra nada.
 */
export function onlyRuleWorkers(
  rule: PaymentRule,
  workers: Worker[],
): Worker[] {
  const chosen = new Set((rule.specificWorkers ?? []).map((w) => w.id));
  return chosen.size ? workers.filter((w) => chosen.has(w.id)) : workers;
}
