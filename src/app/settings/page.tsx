"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../PageHeader";
import { SlidersHorizontal, Tag, MapPin, X, Save, Check, Plus } from "lucide-react";

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
      <button
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

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

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <PageHeader active="/settings" />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Configurações do cron diário
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Categorias e cidades usadas na rotação diária de prospecção
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <Tag className="h-4 w-4" />
                Categorias
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Chip key={c} label={c} onRemove={() => setCategories(categories.filter((x) => x !== c))} />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                  placeholder="Nova categoria (ex: pet shops)"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <button
                  onClick={addCategory}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <MapPin className="h-4 w-4" />
                Cidades
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {cities.map((c) => (
                  <Chip key={c} label={c} onRemove={() => setCities(cities.filter((x) => x !== c))} />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCity())}
                  placeholder="Nova cidade (ex: Natal, RN)"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <button
                  onClick={addCity}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  Salvo!
                </span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
