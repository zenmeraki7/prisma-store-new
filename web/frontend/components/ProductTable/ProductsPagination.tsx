// web/frontend/src/components/ProductsPagination.tsx
import { memo } from "react";
import { Stack, Button } from "@shopify/polaris";

interface ProductsPaginationProps {
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null;
  onNext: () => void;
  onPrev: () => void;
}


export const ProductsPagination = memo(
  function ProductsPagination({
    pageInfo,
    onNext,
    onPrev,
  }: ProductsPaginationProps): JSX.Element | null {
    if (!pageInfo) return null;

    return (
      <Stack align="space-between">
        <Button
          disabled={!pageInfo.hasPreviousPage}
          onClick={onPrev}
        >
          Previous
        </Button>

        <Button
          primary
          disabled={!pageInfo.hasNextPage}
          onClick={onNext}
        >
          Next
        </Button>
      </Stack>
    );
  }
);

