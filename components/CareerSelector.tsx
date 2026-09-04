"use client";

import { useMemo, useState } from "react";
import { CAREERS, formatCareerLabel } from "@/lib/careers/config";

type CareerSelectorProps = {
  userId?: string | null;
  initialCareers?: string[];
  maxSelections?: number;
  onSaved?: (payload: { primary: string; secondary: string[]; careers: string[] }) => void;
};

export default function CareerSelector({
  userId,
  initialCareers = [],
  maxSelections = 3,
  onSaved,
}: CareerSelectorProps) {
  const [selected, setSelected] = useState<string[]>(initialCareers.slice(0, maxSelections));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const canSave = Boolean(userId) && selected.length > 0 && selected.length <= maxSelections;

  const selectedText = useMemo(() => {
    if (selected.length === 0) {
      return "No paths selected yet.";
    }

    return `Primary: ${formatCareerLabel(selected[0])}${selected.length > 1 ? ` | Secondary: ${selected.slice(1).map(formatCareerLabel).join(", ")}` : ""}`;
  }, [selected]);

  function toggleCareer(career: string) {
    setMessage("");

    setSelected((prev) => {
      if (prev.includes(career)) {
        return prev.filter((item) => item !== career);
      }

      if (prev.length >= maxSelections) {
        return prev;
      }

      return [...prev, career];
    });
  }

  async function saveSelections() {
    if (!canSave || !userId) {
      setMessage("Sign in and pick at least one career path.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/careers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, careers: selected }),
      });

      const payload = (await response.json()) as {
        error?: string;
        primary?: string;
        secondary?: string[];
      };

      if (!response.ok) {
        setMessage(payload.error || "Failed to save career paths.");
        return;
      }

      const primary = String(payload.primary || selected[0] || "");
      const secondary = Array.isArray(payload.secondary) ? payload.secondary : selected.slice(1);

      setMessage("Career paths saved.");
      onSaved?.({ primary, secondary, careers: selected });
    } catch {
      setMessage("Could not save right now. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">Select income paths (up to {maxSelections}):</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {CAREERS.map((career) => {
          const active = selected.includes(career);
          const disabled = !active && selected.length >= maxSelections;

          return (
            <button
              key={career}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700"} ${disabled ? "opacity-40" : ""}`}
              onClick={() => toggleCareer(career)}
              disabled={disabled}
            >
              {active ? "☑" : "☐"} {formatCareerLabel(career)}
            </button>
          );
        })}
      </div>

      <p className="mb-3 text-sm text-gray-700">{selectedText}</p>

      <button
        type="button"
        onClick={() => void saveSelections()}
        disabled={!canSave || isSaving}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save career paths"}
      </button>

      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
