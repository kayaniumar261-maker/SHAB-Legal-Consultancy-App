import { useEffect, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T[],
) {
  const [data, setData] = useState<T[]>(() => {
    const saved = localStorage.getItem(key);

    return saved
      ? JSON.parse(saved)
      : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(
      key,
      JSON.stringify(data),
    );
  }, [key, data]);

  return [data, setData] as const;
}
