// Builds a Prisma cursor object for pagination
export function buildCursor({ cursor, direction }) {
  if (!cursor) return {};

  return {
    cursor: { id: cursor },
    skip: 1,
    ...(direction === "prev" ? { take: -1 } : {}),
  };
}
