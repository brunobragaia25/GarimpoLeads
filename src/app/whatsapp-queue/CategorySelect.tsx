"use client";

import { useRouter } from "next/navigation";

export function CategorySelect({
  categories,
  value,
  siteFilter,
}: {
  categories: string[];
  value: string;
  siteFilter: string;
}) {
  const router = useRouter();

  function handleChange(category: string) {
    const searchParams = new URLSearchParams();
    if (siteFilter !== "all") searchParams.set("site", siteFilter);
    if (category !== "all") searchParams.set("category", category);
    const query = searchParams.toString();
    router.push(query ? `/whatsapp-queue?${query}` : "/whatsapp-queue");
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
    >
      <option value="all">Todas as categorias</option>
      {categories.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}
