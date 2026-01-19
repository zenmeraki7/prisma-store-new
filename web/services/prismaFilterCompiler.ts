// services/prismaFilterCompiler.ts
import { Prisma } from "@prisma/client";

/* -------------------------------------------------- */
/* Types                                              */
/* -------------------------------------------------- */

type ConditionNode = {
  condition: {
    field: string;
    op: string;
    value?: any;
  };
};

type GroupNode =
  | { and: FilterNode[] }
  | { or: FilterNode[] };

type FilterNode = ConditionNode | GroupNode;

/* -------------------------------------------------- */
/* Compiler                                           */
/* -------------------------------------------------- */

export function compileFilterToPrisma(
  dsl?: FilterNode
): Prisma.ProductWhereInput {
  if (!dsl) return {};

  if ("and" in dsl) {
    return {
      AND: dsl.and.map(compileFilterToPrisma),
    };
  }

  if ("or" in dsl) {
    return {
      OR: dsl.or.map(compileFilterToPrisma),
    };
  }

  const { field, op, value } = dsl.condition;

  /* ---------------- Product fields ---------------- */

  if (field.startsWith("product.")) {
    const col = field.replace("product.", "");

    return mapOperator(col, op, value);
  }

  /* ---------------- Variant rollups ---------------- */

  if (field === "product.totalInventory") {
    return {
      rollup: mapOperator("totalInventory", op, value),
    };
  }

  if (field === "variant.price") {
    return {
      rollup: {
        minPrice: mapOperator("minPrice", op, value).minPrice,
      },
    };
  }

  return {};
}

/* -------------------------------------------------- */
/* Operator mapping                                   */
/* -------------------------------------------------- */

function mapOperator(
  field: string,
  op: string,
  value: any
): any {
  switch (op) {
    case "is":
    case "eq":
      return { [field]: value };

    case "is_not":
    case "neq":
      return { NOT: { [field]: value } };

    case "contains":
      return { [field]: { contains: value } };

    case "contains_ci":
      return {
        [field]: {
          contains: value,
          mode: "insensitive",
        },
      };

    case "starts_with":
      return { [field]: { startsWith: value } };

    case "ends_with":
      return { [field]: { endsWith: value } };

    case "gt":
      return { [field]: { gt: Number(value) } };

    case "gte":
      return { [field]: { gte: Number(value) } };

    case "lt":
      return { [field]: { lt: Number(value) } };

    case "lte":
      return { [field]: { lte: Number(value) } };

    case "between":
      return {
        [field]: {
          gte: Number(value[0]),
          lte: Number(value[1]),
        },
      };

    case "is_blank":
      return { [field]: null };

    case "is_not_blank":
      return { NOT: { [field]: null } };

    default:
      return {};
  }
}
