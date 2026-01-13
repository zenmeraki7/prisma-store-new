export interface ProductSummary {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  price: string;
  tags?: string[];
  featuredImageUrl?: string | null;
}

