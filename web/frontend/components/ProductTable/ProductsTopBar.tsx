// web/frontend/src/components/ProductsTopBar.tsx
import { memo, useMemo } from "react";
import {
  Stack,
  TextField,
  Button,
  Icon,
} from "@shopify/polaris";
// import {
//   SearchIcon,
//   FilterIcon,
// } from "@shopify/polaris-icons";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface ProductsTopBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
}

/* ------------------------------------------------------------------ */
/* Constants (hoisted for perf)                                        */
/* ------------------------------------------------------------------ */

const SEARCH_CONTAINER_STYLE: React.CSSProperties = {
  flex: 1,
  maxWidth: 420,
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export const ProductsTopBar = memo(function ProductsTopBar({
  searchValue,
  onSearchChange,
  onFilterClick,
}: ProductsTopBarProps): JSX.Element {

    return (
<Stack
  align="space-between"
  wrap={false} // keeps items on one row
>
  <div style={{ flex: 1, marginRight: 8 }}> 
    {/* Makes search bar take remaining space */}
    <TextField
      value={searchValue}
      onChange={onSearchChange}
      placeholder="Search products"
      autoComplete="off"
      // prefix={searchIcon}
    />
  </div>

  <Button onClick={onFilterClick}>
    Filter
  </Button>
</Stack>

    );
  }
);
