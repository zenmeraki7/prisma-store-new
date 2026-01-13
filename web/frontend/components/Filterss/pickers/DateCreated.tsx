import React from "react";
import DateFilter from "./DateFilter";

export default function DateCreated(
  props: Omit<React.ComponentProps<typeof DateFilter>, "label">
) {
  return <DateFilter label="Date Created" {...props} />;
}
