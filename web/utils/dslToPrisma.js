// Converts a filter DSL into a Prisma "where" object

export function dslToPrismaWhere(dsl) {
  if (!dsl) return {};

  // GROUPS
  if (dsl.and) {
    return { AND: dsl.and.map(dslToPrismaWhere) };
  }

  if (dsl.or) {
    return { OR: dsl.or.map(dslToPrismaWhere) };
  }

  // CONDITION
  const { field, op, value } = dsl.condition;

  // 🔥 FIX: normalize "product.status" → "status"
const normalizeValue = (field, value) => {
  if (field === "status" && typeof value === "string") {
    return value.toLowerCase();
  }
  return value;
};
const normalizedValue = normalizeValue(normalizedField, value);

  switch (op) {
    case "is":
      return { [normalizedField]: normalizedValue };
    case "is_not":
      return {
        NOT: {
          [normalizedField]: normalizedValue 
        },
      };

    case "contains":
      return {
        [normalizedField]: { contains: value, mode: "insensitive" },
      };

    case "startsWith":
      return {
        [normalizedField]: { startsWith: value, mode: "insensitive" },
      };

    case "endsWith":
      return {
        [normalizedField]: { endsWith: value, mode: "insensitive" },
      };

    case "in":
      return {
        [normalizedField]: { in: value },
      };

    case "not_in":
      return {
        [normalizedField]: { notIn: value },
      };

    default:
      throw new Error(`Unsupported operator: ${op}`);
  }
}

