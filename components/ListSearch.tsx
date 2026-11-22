"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ListSearch({
  search,
  label,
  placeholder,
}: {
  search: string;
  label: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setValue(search);
  }, [search]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onSearch(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams(searchParams.toString());
    timer.current = setTimeout(() => {
      const trimmed = next.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);
  }

  return (
    <label className="customer-search">
      <span>{label}</span>
      <input
        type="search"
        value={value}
        maxLength={100}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
