export function isRemote(): boolean {
  return (
    process.env.TYPEORM_HOST !== 'localhost' &&
    process.env.TYPEORM_HOST !== '127.0.0.1' &&
    process.env.TYPEORM_HOST !== 'postgres'
  );
}
