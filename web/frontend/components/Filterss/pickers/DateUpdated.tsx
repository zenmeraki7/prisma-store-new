import React from "react";
import DateFilter from "./DateFilter";

export function DateUpdated(props: Omit<React.ComponentProps<typeof DateFilter>, "label">) {
  return <DateFilter label="Date Updated" {...props} />;
}

export default DateUpdated;
