// Converts a filter DSL into a Prisma "where" object
export function dslToPrismaWhere(dsl) {
  if (!dsl) return {};

  // GROUP
  if (dsl.and) {
    return {
      AND: dsl.and.map(dslToPrismaWhere),
    };
  }

  if (dsl.or) {
    return {
      OR: dsl.or.map(dslToPrismaWhere),
    };
  }

  // CONDITION
  const { field, op, value } = dsl.condition;

  switch (op) {
    case "is":
      return { [field]: value };

    case "contains":
      return { [field]: { contains: value, mode: "insensitive" } };

    case "startsWith":
      return { [field]: { startsWith: value, mode: "insensitive" } };

    case "endsWith":
      return { [field]: { endsWith: value, mode: "insensitive" } };

    case "not":
      return { NOT: { [field]: value } };

    default:
      throw new Error(`Unsupported operator: ${op}`);
  }
}
