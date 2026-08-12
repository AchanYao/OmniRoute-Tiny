"use client";

import { useEffect, useState } from "react";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";

export type SameModelComboCandidate = {
  modelId: string;
  providers: Array<{ providerId: string; connectionCount: number }>;
};

interface SameModelComboCreatorProps {
  existingNames: string[];
  creating: boolean;
  onCreate: (candidate: SameModelComboCandidate) => Promise<unknown> | unknown;
}

export default function SameModelComboCreator({
  existingNames,
  creating,
  onCreate,
}: SameModelComboCreatorProps) {
  const [candidates, setCandidates] = useState<SameModelComboCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/combos/same-model-candidates", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load candidates");
        return response.json();
      })
      .then((body) => {
        if (cancelled) return;
        const available = (Array.isArray(body.candidates) ? body.candidates : []).filter(
          (candidate: SameModelComboCandidate) => !existingNames.includes(candidate.modelId)
        );
        setCandidates(available);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existingNames]);

  return (
    <Card padding="sm">
      <div>
        <h2 className="text-sm font-semibold text-text-main">Configure automatic aggregation</h2>
        <p className="mt-1 text-xs text-text-muted">
          Same-ID models already aggregate automatically. Create a Priority Combo to customize
          provider order, accounts, retries, and other routing options.
        </p>
      </div>
      {loading ? (
        <p className="mt-3 text-xs text-text-muted">Loading models...</p>
      ) : candidates.length === 0 ? (
        <p className="mt-3 text-xs text-text-muted">No unconfigured same-ID models</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {candidates.map((candidate) => (
            <li
              key={candidate.modelId}
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-main">{candidate.modelId}</p>
                <p className="text-xs text-text-muted">
                  {candidate.providers.map((provider) => provider.providerId).join(" · ")}
                </p>
              </div>
              <Button
                size="sm"
                icon="tune"
                disabled={creating}
                onClick={() => void onCreate(candidate)}
              >
                {creating ? "Creating..." : "Create & configure"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          Could not load same-model candidates.
        </p>
      )}
    </Card>
  );
}
