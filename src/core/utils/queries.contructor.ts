// Ambas funciones pegan los valores tal cual en el SQL, sin escapar: nunca
// con datos que lleguen del cliente.

/** `ANY('{a,b,c}')` para comparar con una lista en Postgres. */
export const constructAnyPostgres = (values: any[]) => {
  let query = "ANY('{";
  values.forEach((v, i) => {
    query = query.concat(v);
    if (i < values.length - 1) query = query.concat(`,`);
  });
  query = query.concat("}')");
  return query;
};

/** `(a,b,c)` para un `IN`. */
export const constructArrayPostgres = (values: any[]) => {
  let query = '(';
  values.forEach((v, i) => {
    query = query.concat(v);
    if (i < values.length - 1) query = query.concat(`,`);
  });
  query = query.concat(')');
  return query;
};
