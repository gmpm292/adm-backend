export function context({ req, res, extra }) {
  if (extra) {
    return {
      req: {
        header: () => `${extra.accessToken}`,
      } as unknown as Request,
    };
  }
  return { req, res };
}
