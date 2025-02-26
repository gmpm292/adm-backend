export const constructAnyPostgres = (values: any[]) => {
  let query = "ANY('{";
  values.forEach((v, i) => {
    query = query.concat(v);
    if (i < values.length - 1) query = query.concat(`,`);
  });
  query = query.concat("}')");
  return query;
};

export const constructArrayPostgres = (values: any[]) => {
  let query = '(';
  values.forEach((v, i) => {
    query = query.concat(v);
    if (i < values.length - 1) query = query.concat(`,`);
  });
  query = query.concat(')');
  return query;
};
