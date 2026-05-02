import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-stone-50 px-6 text-stone-900">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Wardrobe</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Ridhima&rsquo;s Closet
        </h1>
        <p className="max-w-md text-base text-stone-600">
          Coming soon. The morning stylist.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
          <Link
            href="/onboarding"
            className="rounded border border-stone-300 bg-white px-4 py-2 font-medium text-stone-700 hover:bg-stone-100"
          >
            Style profile
          </Link>
          <Link
            href="/admin/tag"
            className="rounded border border-stone-300 bg-white px-4 py-2 font-medium text-stone-700 hover:bg-stone-100"
          >
            Tag closet
          </Link>
        </div>
      </div>
    </main>
  );
}
