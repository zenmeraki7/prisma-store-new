// web/routes/shopifyproducts.js
import shopify from "../shopify.js";

/**
 * Fetch all products from Shopify store
 * @param {import("@shopify/shopify-api").Session} session
 */
export async function fetchAllProducts(session) {
  const client = new shopify.api.clients.Rest({
    session,
  });

  const products = [];
  let pageInfo = undefined;

  do {
    const response = await client.get({
      path: "products",
      query: {
        limit: 250,
        ...(pageInfo ? { page_info: pageInfo } : {}),
      },
    });

    products.push(...response.body.products);

    pageInfo = response.pageInfo?.nextPage?.query?.page_info;
  } while (pageInfo);

  return products;
}
