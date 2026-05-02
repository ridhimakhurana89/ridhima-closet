"use client";

import { useEffect, useMemo, useState } from "react";
import { QUESTIONNAIRE, type Question, type Section } from "@/lib/questionnaire";

type Answers = Record<string, unknown>;

type ProfileResponse = {
  id: string;
  color_season: string | null;
  body_notes: string | null;
  style_rules: string[] | null;
  no_go_rules: string[] | null;
  voice_tone: string | null;
  profile_answers: Answers;
  profile_updated_at: string | null;
};

const LEGACY_TO_QUESTIONNAIRE_PREFILL: (p: ProfileResponse) => Answers = (p) => {
  const seed: Answers = {};
  if (p.color_season === "deep-autumn") seed.seasonal_palette = "deep_autumn";
  if (p.color_season === "soft-autumn") seed.seasonal_palette = "soft_autumn";
  return seed;
};

export default function OnboardingClient() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [showAskLater, setShowAskLater] = useState(false);
  const [unsureExpanded, setUnsureExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        const p: ProfileResponse = data.profile;
        setProfile(p);
        const merged = { ...LEGACY_TO_QUESTIONNAIRE_PREFILL(p), ...(p.profile_answers || {}) };
        setAnswers(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sections = QUESTIONNAIRE.sections;
  const activeSection = sections[activeSectionIdx];
  const totalSections = sections.length;

  function shouldShowQuestion(q: Question): boolean {
    if (q.ask_later && !showAskLater) return false;
    if (q.branching?.skip_if) {
      const { question_id, equals, includes } = q.branching.skip_if;
      const v = answers[question_id];
      if (equals !== undefined && v === equals) return false;
      if (includes !== undefined && Array.isArray(v) && v.includes(includes)) return false;
    }
    return true;
  }

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function saveSection() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_answers: answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveSection();
    if (activeSectionIdx < totalSections - 1) {
      setActiveSectionIdx(activeSectionIdx + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBack() {
    if (activeSectionIdx > 0) {
      setActiveSectionIdx(activeSectionIdx - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-12 text-center text-stone-600">
        Loading your profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-stone-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Your Style Profile</h1>
          <p className="mt-1 text-sm text-stone-600">
            Everything the AI stylist uses to recommend your outfits. Edit anytime.
            {profile?.profile_updated_at && (
              <span className="ml-2 text-stone-400">
                Last saved {new Date(profile.profile_updated_at).toLocaleString()}
              </span>
            )}
          </p>
        </header>

        <SectionTabs
          sections={sections}
          activeIdx={activeSectionIdx}
          onClick={setActiveSectionIdx}
          answers={answers}
        />

        <section className="mt-4 rounded-lg border border-stone-200 bg-white p-5">
          <header className="mb-4">
            <h2 className="text-lg font-semibold">{activeSection.title}</h2>
            <p className="mt-1 text-xs text-stone-500">{activeSection.purpose}</p>
          </header>

          <div className="space-y-5">
            {activeSection.questions.filter(shouldShowQuestion).map((q) => (
              <QuestionInput
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
                unsureExpanded={unsureExpanded[q.id]}
                setUnsureExpanded={(open) =>
                  setUnsureExpanded((prev) => ({ ...prev, [q.id]: open }))
                }
                allAnswers={answers}
                setAnswer={setAnswer}
              />
            ))}
          </div>

          {activeSection.questions.some((q) => q.ask_later) && (
            <div className="mt-5 rounded border border-stone-200 bg-stone-50 p-3 text-xs">
              <label className="flex items-center gap-2 text-stone-700">
                <input
                  type="checkbox"
                  checked={showAskLater}
                  onChange={(e) => setShowAskLater(e.target.checked)}
                />
                Show optional &quot;ask me later&quot; questions in this section
              </label>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4 text-sm">
            <button
              onClick={handleBack}
              disabled={activeSectionIdx === 0}
              className="rounded border border-stone-300 px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              {savedAt && !saving && (
                <span className="text-xs text-stone-500">Saved {savedAt}</span>
              )}
              <button
                onClick={saveSection}
                disabled={saving}
                className="rounded border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleNext}
                disabled={saving}
                className="rounded bg-stone-900 px-3 py-1.5 font-medium text-white hover:bg-black disabled:opacity-40"
              >
                {activeSectionIdx === totalSections - 1
                  ? saving
                    ? "Saving..."
                    : "Save & finish"
                  : saving
                  ? "Saving..."
                  : "Save & next"}
              </button>
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-stone-400">
          You can return to any section anytime. Nothing here is permanent.
        </p>
      </div>
    </main>
  );
}

function SectionTabs({
  sections,
  activeIdx,
  onClick,
  answers,
}: {
  sections: Section[];
  activeIdx: number;
  onClick: (i: number) => void;
  answers: Answers;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {sections.map((s, i) => {
        const completion = sectionCompletion(s, answers);
        const active = i === activeIdx;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onClick(i)}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition ${
              active ? "bg-stone-900 text-white" : "bg-white text-stone-700 hover:bg-stone-100"
            } border border-stone-200`}
          >
            <span>{s.title}</span>
            <span
              className={`text-[10px] ${active ? "text-stone-300" : "text-stone-400"}`}
            >
              {completion}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function sectionCompletion(s: Section, answers: Answers): string {
  const required = s.questions.filter((q) => !q.ask_later);
  const filled = required.filter((q) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  return `${filled.length}/${required.length}`;
}

function QuestionInput({
  question,
  value,
  onChange,
  unsureExpanded,
  setUnsureExpanded,
  allAnswers,
  setAnswer,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  unsureExpanded: boolean | undefined;
  setUnsureExpanded: (open: boolean) => void;
  allAnswers: Answers;
  setAnswer: (id: string, v: unknown) => void;
}) {
  const hasUnsureFollowup = question.followup_if_unsure && question.followup_if_unsure.length > 0;
  const isUnsure = value === "not_sure";

  return (
    <div className="rounded border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <label className="text-sm font-medium text-stone-900">
          {question.prompt}
          {!question.skip_allowed && <span className="ml-1 text-amber-600">*</span>}
        </label>
        {question.skip_allowed && <span className="text-[10px] text-stone-400">optional</span>}
      </div>

      <Renderer question={question} value={value} onChange={onChange} />

      {question.rationale && (
        <p className="mt-2 text-[11px] text-stone-400">Why we ask: {question.rationale}</p>
      )}

      {hasUnsureFollowup && isUnsure && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-900">
            No worries — answer these and we&apos;ll figure it out:
          </p>
          <div className="space-y-3">
            {question.followup_if_unsure!.map((sub) => (
              <div key={sub.id}>
                <label className="mb-1 block text-xs font-medium text-stone-800">
                  {sub.prompt}
                </label>
                <Renderer
                  question={sub}
                  value={allAnswers[sub.id]}
                  onChange={(v) => setAnswer(sub.id, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {hasUnsureFollowup && !isUnsure && (
        <button
          type="button"
          onClick={() => setUnsureExpanded(!unsureExpanded)}
          className="mt-2 text-[11px] text-stone-500 underline-offset-2 hover:underline"
        >
          {unsureExpanded ? "Hide" : "Not sure?"}
        </button>
      )}
    </div>
  );
}

function Renderer({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (question.type) {
    case "single_select":
    case "image_grid": {
      const isImageGrid = question.type === "image_grid";
      return (
        <div className={isImageGrid ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2"}>
          {question.options?.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(selected ? undefined : opt.value)}
                className={`rounded border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-800 hover:border-stone-500"
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                {opt.hint && (
                  <div
                    className={`mt-0.5 text-[11px] ${
                      selected ? "text-stone-300" : "text-stone-500"
                    }`}
                  >
                    {opt.hint}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      );
    }
    case "multi_select": {
      const arr = (Array.isArray(value) ? (value as string[]) : []) as string[];
      return (
        <div className="flex flex-wrap gap-2">
          {question.options?.map((opt) => {
            const selected = arr.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = selected ? arr.filter((v) => v !== opt.value) : [...arr, opt.value];
                  onChange(next);
                }}
                className={`rounded border px-3 py-1.5 text-sm transition ${
                  selected
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-800 hover:border-stone-500"
                }`}
              >
                {opt.label}
                {opt.hint && (
                  <span
                    className={`ml-2 text-[10px] ${
                      selected ? "text-stone-300" : "text-stone-500"
                    }`}
                  >
                    ({opt.hint})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      );
    }
    case "slider": {
      const num = typeof value === "number" ? value : 3;
      return (
        <div>
          <input
            type="range"
            min={question.min ?? 1}
            max={question.max ?? 5}
            value={num}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-stone-500">
            <span>{question.min ?? 1}</span>
            <span className="font-medium text-stone-800">{num}</span>
            <span>{question.max ?? 5}</span>
          </div>
        </div>
      );
    }
    case "free_text": {
      const str = typeof value === "string" ? value : "";
      const long = str.length > 80 || question.id.includes("note") || question.id.includes("description");
      return long ? (
        <textarea
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={3}
          className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      ) : (
        <input
          type="text"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      );
    }
    case "measurement": {
      const num = typeof value === "number" ? value : "";
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={question.min}
            max={question.max}
            value={num}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder={question.placeholder}
            className="w-32 rounded border border-stone-300 px-3 py-2 text-sm"
          />
          {question.unit && <span className="text-sm text-stone-500">{question.unit}</span>}
        </div>
      );
    }
  }
}
