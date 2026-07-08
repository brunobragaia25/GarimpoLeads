"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newCity, setNewCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setCities(data.cities ?? []);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories, cities }),
    });
    setSaving(false);
    setSaved(true);
  }

  function addCategory() {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setNewCategory("");
    }
  }

  function addCity() {
    const trimmed = newCity.trim();
    if (trimmed && !cities.includes(trimmed)) {
      setCities([...cities, trimmed]);
      setNewCity("");
    }
  }

  if (loading) {
    return <div className="p-8 text-zinc-600 dark:text-zinc-400">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← voltar ao dashboard
        </a>

        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Configurações do cron diário
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Categorias e cidades usadas na rotação diária de prospecção.
        </p>

        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Categorias</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {c}
                <button
                  onClick={() => setCategories(categories.filter((x) => x !== c))}
                  className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
              placeholder="Nova categoria (ex: pet shops)"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              onClick={addCategory}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cidades</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {cities.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {c}
                <button
                  onClick={() => setCities(cities.filter((x) => x !== c))}
                  className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCity())}
              placeholder="Nova cidade (ex: Natal, RN)"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              onClick={addCity}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Adicionar
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
        {saved && (
          <span className="ml-3 text-sm text-green-600 dark:text-green-400">Salvo!</span>
        )}
      </div>
    </div>
  );
}
