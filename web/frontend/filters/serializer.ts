import { FilterDSL } from "./types";

export function serializeFilters(group: FilterDSL) {
  return group.and.length ? group : null;
}
