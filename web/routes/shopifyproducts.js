import shopify from "../shopify.js";

export async function fetchAllProducts(session) {
  console.log("📡 Fetching products from Shopify REST API");

  const client = new shopify.api.clients.Rest({ session });

  const products = [];
  let pageInfo;

  do {
    const response = await client.get({
      path: "products",
      query: {
        limit: 250,
        ...(pageInfo ? { page_info: pageInfo } : {}),
      },
    });

    console.log(
      `➡️ Received ${response.body.products.length} products`
    );

    products.push(...response.body.products);
    pageInfo = response.pageInfo?.nextPage?.query?.page_info;
  } while (pageInfo);

  return products;
}
