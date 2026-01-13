import { t } from "i18next";

export const filterFieldConfigs = {
  // Collections – enum-ish
  collection: {
    title: t("filterByCollection"),
    tag: t("collection"),
    filterKey: "collection_name",
    operatorKey: "collection_options",
    selectOptions: [
      { label: "is", value: "is" },
      { label: "is not", value: "is_not" },
    ],
    isAutocomplete: true,
    fetchUrl: "/api/collection/get-all",
  },

  // VENDOR (text operators)
  vendor: {
    title: t("filterByVendor"),
    tag: t("vendor"),
    filterKey: "vendor",
    operatorKey: "vendor_op",
    selectOptions: TEXT_OPERATOR_OPTIONS,
    isAutocomplete: false,
  },

  description: {
    title: t("filterByDescription"),
    tag: t("description"),
    filterKey: "description",
    operatorKey: "description_op",
    // maybe you want fewer than full set for description:
    selectOptions: [
      { label: "contains", value: "contains" },
      { label: "does not contain", value: "not_contains" },
      { label: "is", value: "equals" },
      { label: "is not", value: "not_equals" },
      { label: "is empty / blank", value: "is_blank" },
      { label: "is not empty / blank", value: "is_not_blank" },
    ],
    isAutocomplete: false,
  },

  handle: {
    title: t("filterByHandle"),
    tag: t("handle"),
    filterKey: "handle",
    operatorKey: "handle_op",
    // reuse full text operators
    selectOptions: TEXT_OPERATOR_OPTIONS,
    isAutocomplete: false,
  },

  // TITLE
  title: {
    title: t("filterByTitle"),
    tag: t("ProductTitle"),
    filterKey: "title",
    operatorKey: "title_op",
    selectOptions: TEXT_OPERATOR_OPTIONS,
    isAutocomplete: false,
  },

  // TAG
  tag: {
    title: t("filterByTag"),
    tag: t("Tags"),
    filterKey: "tag",
    operatorKey: "tag_op",
    // You can also reuse TEXT_OPERATOR_OPTIONS, or keep a subset:
    selectOptions: [
      { label: "contains (case-sensitive)", value: "contains" },
      { label: "does not contain (case-sensitive)", value: "not_contains" },
      { label: "contains (case-insensitive)", value: "contains_ci" },
      { label: "does not contain (case-insensitive)", value: "not_contains_ci" },
      { label: "contains the text", value: "contains" },
      { label: "does not contain the text", value: "not_contains" },
      { label: "is empty / blank", value: "is_blank" },
      { label: "is not empty / blank", value: "is_not_blank" },
    ],
    isAutocomplete: false,
    type: "text",
  },

  theme_template: {
    title: "Filter by Theme Template",
    tag: "Theme Template",
    filterKey: "themetemplate",
    operatorKey: "themetemplate_op",
    selectOptions: [
      { label: "equals", value: "equals" },
      { label: "does not equal", value: "not_equals" },
      { label: "is empty / blank", value: "is_blank" },
      { label: "is not empty / blank", value: "is_not_blank" },
    ],
    isAutocomplete: false,
    type: "text",
  },

  product_type: {
    title: t("filterByProductType"),
    tag: t("ProductType"),
    filterKey: "product_type",
    operatorKey: "product_type_options",
    selectOptions: TEXT_OPERATOR_OPTIONS,
    isAutocomplete: true,
    fetchUrl: "/api/products/product-type-all",
  },

  option_one_modal: {
    title: "Filter Options",
    tag: "Option One",
    filterKey: "option_one",
    operatorKey: "option_one_op",
    // maybe slightly reduced text operator set:
    selectOptions: [
      { label: "contains", value: "contains" },
      { label: "does not contain", value: "not_contains" },
      {
        label: "contains any of the words",
        value: "contains_any_words",
      },
      { label: "ends with", value: "ends_with" },
      { label: "starts with", value: "starts_with" },
      { label: "does not start with", value: "not_starts_with" },
      {
        label: "contains (case sensitive)",
        value: "contains_cs",
      },
      { label: "equals (case sensitive)", value: "equals_cs" },
    ],
    isAutocomplete: false,
    type: "text",
  },

  product_category: {
    title: "Filter by Product Category",
    tag: "Product Category",
    filterKey: "product_category",
    operatorKey: "product_category_op",
    selectOptions: SIMPLE_ENUM_OPERATOR_OPTIONS,
    isAutocomplete: false,
    type: "text",
  },
};