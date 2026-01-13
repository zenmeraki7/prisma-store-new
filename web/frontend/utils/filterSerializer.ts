// web/frontend/utils/FilterSerializer.ts

import type { FilterGroup, FilterRule } from "../stores/filterStore";
import { FILTER_FIELDS } from "../config/filterFields";

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function getFieldDef(fieldKey: string) {
  return Object.values(FILTER_FIELDS)
    .flat()
    .find((f) => f.fieldKey === fieldKey);
}

function escapeValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

/* ------------------------------------------------------------------ */
/* Serializer */
/* ------------------------------------------------------------------ */

/**
 * 🧠 FILTER SERIALIZER (AST → Shopify Search Syntax)
 *
 * IMPORTANT CONSTRAINTS:
 * - Only PRODUCT-scope fields are compiled here
 * - Variant / Inventory / Metafield filters are skipped
 * - Backend resolves those via DB / Bulk APIs
 */
export class FilterSerializer {
  /**
   * Entry Point
   */
  static serialize(groups: FilterGroup[]): string {
    if (!groups.length) return "";

    const compiledGroups = groups
      .map((group) => this.visitGroup(group))
      .filter(Boolean) as string[];

    return compiledGroups.join(" AND ");
  }

  /**
   * 🌲 Group Visitor
   */
  private static visitGroup(group: FilterGroup): string | null {
    const ruleStrings = group.rules
      .map((rule) => this.visitRule(rule))
      .filter(Boolean) as string[];

    if (!ruleStrings.length) return null;

    // ⚠️ BUG FIX: operator name (was combinator)
    const joiner = ` ${group.operator} `;
    const joined = ruleStrings.join(joiner);

    return ruleStrings.length > 1 ? `(${joined})` : joined;
  }

  /**
   * 🍃 Rule Visitor
   */
  private static visitRule(rule: FilterRule): string | null {
    // ⚠️ BUG FIX: correct field identifier
    if (!rule.fieldPath || rule.value === "") return null;

    const field = getFieldDef(rule.fieldPath);
    if (!field) return null;

    // ❌ Skip non-product filters here
    if (field.meta?.scope && field.meta.scope !== "product") {
      return null;
    }

    // ❌ Skip invalid operators
    if (!field.operators.includes(rule.operator)) {
      return null;
    }

    const key = field.fieldKey.replace("product.", "");
    const value = escapeValue(String(rule.value));

    switch (rule.operator) {
      case "eq":
        return `${key}:"${value}"`;

      case "neq":
        return `-${key}:"${value}"`;

      case "contains":
        return `${key}:*${value}*`;

      case "starts_with":
        return `${key}:${value}*`;

      case "gt":
      case "after":
        return `${key}:>${value}`;

      case "lt":
      case "before":
        return `${key}:<${value}`;

      default:
        return null;
    }
  }
}
