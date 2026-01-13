import { DataTable, Thumbnail } from "@shopify/polaris";
import React from "react";

type Product = {
  id: string;
  title: string;
  vendor: string;
  price: string;
  image: string;
};

export default function ProductTable(): JSX.Element {
  // --- Dummy Data ---
  const products: Product[] = [
    {
      id: "101",
      title: "Sample Product A",
      vendor: "BrandX",
      price: "₹499",
      image:
        "https://www.lovemerchandise.co.uk/images/module_images/shop/love_merchandise_eco_sustainable.jpg",
    },
    {
      id: "102",
      title: "Sample Product B",
      vendor: "BrandY",
      price: "₹799",
      image:
        "https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?cs=srgb&dl=pexels-madebymath-90946.jpg&fm=jpg",
    },
    {
      id: "103",
      title: "Sample Product C",
      vendor: "BrandZ",
      price: "₹1,299",
      image:
        "https://5.imimg.com/data5/KC/PC/MY-38629861/dummy-chronograph-watch.jpg",
    },
  ];

  const rows: React.ReactNode[][] = products.map((p) => [
    <Thumbnail source={p.image} alt={p.title} size="small" />,
    p.id,
    p.title,
    p.vendor,
    p.price,
  ]);

  return (
    <DataTable
      columnContentTypes={["text", "text", "text", "text", "numeric"]}
      headings={["Image", "ID", "Title", "Vendor", "Price"]}
      rows={rows}
    />
  );
}
