export const FILTER_FIELDS = {
  // ============================
  // PRODUCT FIELDS
  // ============================
  product: {
    category: {
      label: "Category",
      type: "string",
      path: "category",
    },

    collection: {
      label: "Collection",
      type: "string",
      path: "collection",
    },

    date_created: {
      label: "Date Created",
      type: "date",
      path: "createdAt",
    },

    date_published: {
      label: "Date Published",
      type: "date",
      path: "publishedAt",
    },

    date_updated: {
      label: "Date Updated",
      type: "date",
      path: "updatedAt",
    },

    description: {
      label: "Description",
      type: "string",
      path: "description",
    },

    handle: {
      label: "Handle (URL)",
      type: "string",
      path: "handle",
    },

    inventory_quantity: {
      label: "Inventory Quantity",
      type: "number",
      path: "inventoryQuantity",
    },

    option1_name: {
      label: "Option 1 Name",
      type: "string",
      path: "options.0.name",
    },

    option2_name: {
      label: "Option 2 Name",
      type: "string",
      path: "options.1.name",
    },

    option3_name: {
      label: "Option 3 Name",
      type: "string",
      path: "options.2.name",
    },

    product_id: {
      label: "Product ID",
      type: "string",
      path: "id",
    },

    product_type_custom: {
      label: "Product Type (Custom)",
      type: "string",
      path: "productType",
    },

    seo_visibility: {
      label: "Search Engine Visibility (SEO)",
      type: "boolean",
      path: "seo.visibility",
    },

    status: {
      label: "Status",
      type: "enum",
      options: ["ACTIVE", "DRAFT", "ARCHIVED"],
      path: "status",
    },

    tag: {
      label: "Tag",
      type: "string",
      path: "tags",
      isList: true,
    },

    theme_template: {
      label: "Theme Template",
      type: "string",
      path: "templateSuffix",
    },

    title: {
      label: "Title",
      type: "string",
      path: "title",
    },

    variant_count: {
      label: "Variant Count",
      type: "number",
      path: "variants.length",
    },

    vendor: {
      label: "Vendor",
      type: "string",
      path: "vendor",
    },

    visible_online_store: {
      label: "Visible on Online Store (web)",
      type: "boolean",
      path: "publishedOnWeb",
    },

    visible_pos: {
      label: "Visible on POS",
      type: "boolean",
      path: "publishedOnPOS",
    },
  },

  // ============================
  // VARIANT FIELDS
  // ============================
  variant: {
    barcode: {
      label: "Barcode (ISBN, UPC, GTIN...)",
      type: "string",
      path: "barcode",
    },

    charge_tax: {
      label: "Charge tax on this product",
      type: "boolean",
      path: "chargeTax",
    },

    compare_at_price: {
      label: "Compare-at Price",
      type: "number",
      path: "compareAtPrice",
    },

    inventory_location: {
      label: "Connected Inventory Location",
      type: "string",
      path: "inventoryItem.locations",
      isList: true,
    },

    cost: {
      label: "Cost",
      type: "number",
      path: "cost",
    },

    country_of_origin: {
      label: "Country of Origin",
      type: "string",
      path: "countryOfOrigin",
    },

    hs_tariff: {
      label: "HS Tariff Code",
      type: "string",
      path: "harmonizedSystemCode",
    },

    inventory_policy: {
      label: "Inventory Out of Stock Policy",
      type: "enum",
      options: ["deny", "continue"],
      path: "inventoryPolicy",
    },

    option1_value: {
      label: "Option 1 Value",
      type: "string",
      path: "option1",
    },

    option2_value: {
      label: "Option 2 Value",
      type: "string",
      path: "option2",
    },

    option3_value: {
      label: "Option 3 Value",
      type: "string",
      path: "option3",
    },

    physical_product: {
      label: "Physical Product",
      type: "boolean",
      path: "requiresShipping",
    },

    price: {
      label: "Price",
      type: "number",
      path: "price",
    },

    profit_margin: {
      label: "Profit Margin",
      type: "number",
      path: "profitMargin",
    },

    sku: {
      label: "SKU",
      type: "string",
      path: "sku",
    },

    track_quantity: {
      label: "Track Quantity",
      type: "boolean",
      path: "tracked",
    },

    variant_inventory_quantity: {
      label: "Variant Inventory Quantity",
      type: "number",
      path: "inventoryQuantity",
    },

    variant_title: {
      label: "Variant Title",
      type: "string",
      path: "title",
    },

    weight: {
      label: "Weight",
      type: "number",
      path: "weight",
    },

    weight_unit: {
      label: "Weight Unit",
      type: "enum",
      options: ["g", "kg", "lb", "oz"],
      path: "weightUnit",
    },
  },

  // ============================
  // VARIANT INVENTORY BY LOCATION
  // ============================
  inventory_by_location: {
    custom_location: {
      label: "My Custom Location Inventory",
      type: "number",
      path: "inventory.locations.customLocation",
    },

    shop_location: {
      label: "Shop Location Inventory",
      type: "number",
      path: "inventory.locations.shopLocation",
    },

    snow_city: {
      label: "Snow City Warehouse Inventory",
      type: "number",
      path: "inventory.locations.snowCity",
    },
  },
};
