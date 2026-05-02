"use client";

import { useEffect, useRef, useState } from "react";

type Category = "top" | "bottom" | "outerwear" | "dress" | "shoes" | "accessory";
type ColorFamily = "warm-deep" | "warm-light" | "cool-deep" | "cool-light" | "neutral";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessories" },
];

const COLOR_FAMILIES: ColorFamily[] = ["warm-deep", "warm-light", "cool-deep", "cool-light", "neutral"];

type ItemMetadata = {
  category: Category;
  subcategory: string;
  name: string;
  description: string;
  color_primary: string;
  color_family: ColorFamily;
  silhouette: string;
  length: string;
  formality: number;
  tags: string[];
  flatters_me: boolean;
};

type ItemStatus = "ready" | "drafting" | "drafted" | "saving" | "saved" | "error";

type Item = {
  id: string;
  fileName: string;
  previewUrl: string;
  base64: string;
  mediaType: string;
  metadata: ItemMetadata;
  status: ItemStatus;
  error?: string;
};

type SavedItem = {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  photo_url: string;
  color_primary: string;
  color_family: ColorFamily;
  formality: number;
  flatters_me: boolean;
  tags: string[];
};

const EMPTY_METADATA = (category: Category): ItemMetadata => ({
  category,
  subcategory: "",
  name: "",
  description: "",
  color_primary: "",
  color_family: "warm-deep",
  silhouette: "",
  length: "",
  formality: 3,
  tags: [],
  flatters_me: true,
});

async function compressImage(file: File): Promise<{ base64: string; mediaType: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1200;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.82,
    );
  });

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const previewUrl = URL.createObjectURL(blob);
  return { base64, mediaType: "image/jpeg", previewUrl };
}

export default function TagClient() {
  const [category, setCategory] = useState<Category>("top");
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<{ total: number; by_category: Record<string, number> } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [galleryCategory, setGalleryCategory] = useState<Category | null>(null);
  const [galleryItems, setGalleryItems] = useState<SavedItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const savingIds = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshCounts() {
    try {
      const res = await fetch("/api/save-item");
      if (res.ok) setCounts(await res.json());
    } catch {
      // non-fatal
    }
  }

  async function loadGallery(cat: Category) {
    setGalleryLoading(true);
    try {
      const res = await fetch(`/api/items?category=${cat}`);
      if (!res.ok) throw new Error("Failed to load gallery");
      const data = await res.json();
      setGalleryItems(data.items as SavedItem[]);
    } catch {
      setGalleryItems([]);
    } finally {
      setGalleryLoading(false);
    }
  }

  function toggleGallery(cat: Category) {
    if (galleryCategory === cat) {
      setGalleryCategory(null);
      setGalleryItems([]);
      return;
    }
    setGalleryCategory(cat);
    loadGallery(cat);
  }

  useEffect(() => {
    refreshCounts();
  }, []);

  useEffect(() => {
    if (galleryCategory) loadGallery(galleryCategory);
  }, [counts?.total, galleryCategory]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newItems: Item[] = [];
    for (const file of Array.from(files)) {
      try {
        const { base64, mediaType, previewUrl } = await compressImage(file);
        newItems.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          previewUrl,
          base64,
          mediaType,
          metadata: EMPTY_METADATA(category),
          status: "ready",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Compression failed";
        newItems.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          previewUrl: "",
          base64: "",
          mediaType: "",
          metadata: EMPTY_METADATA(category),
          status: "error",
          error: msg,
        });
      }
    }
    setItems((prev) => [...prev, ...newItems]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function draftMetadata(item: Item) {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "drafting", error: undefined } : it)));
    try {
      const res = await fetch("/api/draft-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: item.base64,
          media_type: item.mediaType,
          category_hint: category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft failed");
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, metadata: { ...data.metadata, category: data.metadata.category as Category }, status: "drafted" }
            : it,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Draft failed";
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "error", error: msg } : it)));
    }
  }

  async function draftAll() {
    if (batchRunning) return;
    setBatchRunning(true);
    try {
      const targets = items.filter((it) => it.status === "ready" || it.status === "error");
      for (const item of targets) {
        await draftMetadata(item);
      }
    } finally {
      setBatchRunning(false);
    }
  }

  async function saveAll() {
    if (batchRunning) return;
    setBatchRunning(true);
    try {
      const targets = items.filter((it) => it.status === "drafted" && it.metadata.name.trim());
      for (const item of targets) {
        await saveItem(item);
      }
    } finally {
      setBatchRunning(false);
    }
  }

  async function saveItem(item: Item) {
    if (!item.metadata.name.trim()) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, error: "Name is required" } : it)));
      return;
    }
    if (savingIds.current.has(item.id)) return;
    savingIds.current.add(item.id);
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "saving", error: undefined } : it)));
    try {
      const res = await fetch("/api/save-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: item.base64,
          media_type: item.mediaType,
          metadata: item.metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "saved" } : it)));
      refreshCounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "error", error: msg } : it)));
    } finally {
      savingIds.current.delete(item.id);
    }
  }

  function discardItem(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }

  function updateMetadata(id: string, patch: Partial<ItemMetadata>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, metadata: { ...it.metadata, ...patch } } : it)),
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Closet Admin — Tag Items</h1>
          <p className="mt-1 text-sm text-stone-600">
            Upload photos, let Claude draft metadata, review/correct, save.
          </p>
        </header>

        <section className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">
              Category:{" "}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="ml-1 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
              className="sr-only"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className={`cursor-pointer rounded border border-stone-300 bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-200 ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              Choose photos
            </label>
            {uploading && <span className="text-sm text-stone-600">Compressing...</span>}

            <button
              onClick={draftAll}
              disabled={batchRunning || items.filter((it) => it.status === "ready").length === 0}
              className="ml-auto rounded bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
            >
              {batchRunning ? "Working..." : "Generate descriptions"}
            </button>
            <button
              onClick={saveAll}
              disabled={batchRunning || items.filter((it) => it.status === "drafted" && it.metadata.name.trim()).length === 0}
              className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-40"
            >
              {batchRunning ? "Working..." : "Save all"}
            </button>
          </div>

          {counts && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-stone-600">Saved so far:</span>
              <span className="rounded bg-stone-100 px-2 py-1 text-stone-700">Total {counts.total}</span>
              {CATEGORIES.map((c) => {
                const count = counts.by_category[c.value] || 0;
                const active = galleryCategory === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleGallery(c.value)}
                    className={`rounded px-2 py-1 transition ${
                      active
                        ? "bg-amber-700 text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {c.label} {count}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {galleryCategory && (
          <section className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {CATEGORIES.find((c) => c.value === galleryCategory)?.label} — saved ({galleryItems.length})
              </h2>
              <button
                type="button"
                onClick={() => toggleGallery(galleryCategory)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Close
              </button>
            </div>
            {galleryLoading ? (
              <p className="text-sm text-stone-500">Loading...</p>
            ) : galleryItems.length === 0 ? (
              <p className="text-sm text-stone-500">Nothing saved in this category yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {galleryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded border p-2 ${
                      item.flatters_me ? "border-stone-200" : "border-amber-300 bg-amber-50"
                    }`}
                  >
                    <img
                      src={item.photo_url}
                      alt={item.name}
                      className="h-32 w-full rounded object-cover"
                      loading="lazy"
                    />
                    <p className="mt-1 truncate text-xs font-medium" title={item.name}>
                      {item.name}
                    </p>
                    <p className="truncate text-[11px] text-stone-500">
                      {item.color_primary} - {item.subcategory} - F{item.formality}
                    </p>
                    {!item.flatters_me && (
                      <p className="text-[11px] text-amber-700">⚠ flagged: violates rules</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="space-y-4">
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              No items yet. Pick a category above, then upload photos.
            </p>
          )}
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onDraft={() => draftMetadata(item)}
              onSave={() => saveItem(item)}
              onDiscard={() => discardItem(item.id)}
              onChange={(patch) => updateMetadata(item.id, patch)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ItemCard({
  item,
  onDraft,
  onSave,
  onDiscard,
  onChange,
}: {
  item: Item;
  onDraft: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onChange: (patch: Partial<ItemMetadata>) => void;
}) {
  const m = item.metadata;
  const saved = item.status === "saved";
  const busy = item.status === "drafting" || item.status === "saving";

  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        saved ? "border-green-300 bg-green-50" : "border-stone-200"
      }`}
    >
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.fileName}
              className="h-48 w-full rounded border border-stone-200 object-cover sm:h-auto"
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded border border-stone-200 bg-stone-100 text-xs text-stone-500">
              No preview
            </div>
          )}
          <p className="mt-2 truncate text-xs text-stone-500" title={item.fileName}>
            {item.fileName}
          </p>
          <div className="mt-1 text-xs">
            Status: <span className="font-medium">{item.status}</span>
          </div>
          {item.error && <p className="mt-1 text-xs text-red-600">{item.error}</p>}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onDraft}
              disabled={busy || saved}
              className="rounded bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-40"
            >
              {item.status === "drafting" ? "Drafting..." : "AI: Draft metadata"}
            </button>
            <button
              onClick={onSave}
              disabled={busy || saved || !m.name.trim()}
              className="rounded bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
            >
              {item.status === "saving" ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
            <button
              onClick={onDiscard}
              disabled={busy}
              className="rounded border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
            >
              {saved ? "Remove from list" : "Discard"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name *">
              <input
                value={m.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Category">
              <select
                value={m.category}
                onChange={(e) => onChange({ category: e.target.value as Category })}
                className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subcategory">
              <input
                value={m.subcategory}
                onChange={(e) => onChange({ subcategory: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Color (primary)">
              <input
                value={m.color_primary}
                onChange={(e) => onChange({ color_primary: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Color family">
              <select
                value={m.color_family}
                onChange={(e) => onChange({ color_family: e.target.value as ColorFamily })}
                className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm"
              >
                {COLOR_FAMILIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Silhouette">
              <input
                value={m.silhouette}
                onChange={(e) => onChange({ silhouette: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Length">
              <input
                value={m.length}
                onChange={(e) => onChange({ length: e.target.value })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Formality (1-5)">
              <input
                type="number"
                min={1}
                max={5}
                value={m.formality}
                onChange={(e) => onChange({ formality: Number(e.target.value) })}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Tags (comma separated)" full>
              <input
                value={m.tags.join(", ")}
                onChange={(e) =>
                  onChange({
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim().toLowerCase())
                      .filter(Boolean),
                  })
                }
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Description" full>
              <textarea
                value={m.description}
                onChange={(e) => onChange({ description: e.target.value })}
                rows={2}
                className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={m.flatters_me}
                onChange={(e) => onChange({ flatters_me: e.target.checked })}
              />
              Flatters me (uncheck for items that violate color/body rules)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block text-xs ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-0.5 block font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
