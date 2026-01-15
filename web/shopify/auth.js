export function authenticate(req, res, next) {
  const session = res.locals.shopify?.session;
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
