import React from "react";
import DateFilter from "./DateFilter";

export function DatePublished(props: Omit<React.ComponentProps<typeof DateFilter>, "label">) {
  return <DateFilter label="Date Published" {...props} />;
}

export default DatePublished;
