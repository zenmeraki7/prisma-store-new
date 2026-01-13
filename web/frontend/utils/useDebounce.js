import { useRef } from "react";

export function useDebounce(callback, delay = 150) {
  const timer = useRef(null);

  const debounced = (...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  return debounced;
}
