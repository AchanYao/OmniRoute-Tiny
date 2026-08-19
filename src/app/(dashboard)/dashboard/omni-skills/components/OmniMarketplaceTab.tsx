"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/shared/components";
import type { SkillsProvider } from "@/lib/skills/providerSettings";

interface MarketplaceSkill {
  name: string;
  description: string;
  skillMdContent?: string;
  version?: string;
  sourceUrl?: string;
}

interface SkillsShSkill {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
}

interface OmniMarketplaceTabProps {
  skillsProvider: SkillsProvider;
}

export function OmniMarketplaceTab({ skillsProvider }: OmniMarketplaceTabProps): JSX.Element {
  const t = useTranslations("skills");
  const [mpQuery, setMpQuery] = useState("");
  const [mpResults, setMpResults] = useState<MarketplaceSkill[]>([]);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState("");
  const [shQuery, setShQuery] = useState("");
  const [shResults, setShResults] = useState<SkillsShSkill[]>([]);
  const [shLoading, setShLoading] = useState(false);
  const [shError, setShError] = useState("");

  const searchMarketplace = async () => {
    setMpLoading(true);
    setMpError("");
    setMpResults([]);
    try {
      const res = await fetch(`/api/skills/marketplace?q=${encodeURIComponent(mpQuery)}`);
      const data = await res.json();
      if (!res.ok) {
        setMpError((data as { error?: string }).error || t("marketplaceError"));
      } else {
        setMpResults(
          Array.isArray(data) ? data : (data as { skills?: MarketplaceSkill[] }).skills || []
        );
      }
    } catch (err) {
      setMpError(err instanceof Error ? err.message : t("marketplaceError"));
    } finally {
      setMpLoading(false);
    }
  };

  const searchSkillsSh = async () => {
    setShLoading(true);
    setShError("");
    setShResults([]);
    try {
      const res = await fetch(`/api/skills/skillssh?q=${encodeURIComponent(shQuery)}`);
      const data = await res.json();
      if (!res.ok) {
        setShError((data as { error?: string }).error || t("marketplaceError"));
      } else {
        setShResults((data as { skills?: SkillsShSkill[] }).skills || []);
      }
    } catch (err) {
      setShError(err instanceof Error ? err.message : t("marketplaceError"));
    } finally {
      setShLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <h3 className="font-semibold mb-2">{t("skillsMarketplace")}</h3>
        <p className="text-sm text-text-muted mb-4">
          {t("activeProvider")}{" "}
          <span className="font-medium">
            {skillsProvider === "skillsmp" ? "SkillsMP" : "skills.sh"}
          </span>
          . {t("changeInSettings")}
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={skillsProvider === "skillsmp" ? mpQuery : shQuery}
            onChange={(e) =>
              skillsProvider === "skillsmp"
                ? setMpQuery(e.target.value)
                : setShQuery(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (skillsProvider === "skillsmp" ? searchMarketplace() : searchSkillsSh())
            }
            placeholder={t("searchMarketplacePlaceholder")}
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={() => (skillsProvider === "skillsmp" ? searchMarketplace() : searchSkillsSh())}
            disabled={skillsProvider === "skillsmp" ? mpLoading : shLoading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {skillsProvider === "skillsmp"
              ? mpLoading
                ? t("searching")
                : t("searchMarketplace")
              : shLoading
                ? t("searching")
                : t("searchMarketplace")}
          </button>
        </div>
        {(skillsProvider === "skillsmp" ? mpError : shError) && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm mb-4">
            {skillsProvider === "skillsmp" ? mpError : shError}
          </div>
        )}
      </Card>

      {skillsProvider === "skillsmp" && mpResults.length > 0 && (
        <div className="grid gap-3">
          {mpResults.map((skill) => (
            <Card key={skill.name}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{skill.name}</h4>
                  <p className="text-sm text-text-muted mt-1">{skill.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {skillsProvider === "skillssh" && shResults.length > 0 && (
        <div className="grid gap-3">
          {shResults.map((skill) => (
            <Card key={skill.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{skill.name}</h4>
                  <p className="text-sm text-text-muted mt-1">
                    {skill.source} · {skill.installs.toLocaleString()} {t("installs")}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {skillsProvider === "skillsmp" && !mpLoading && mpResults.length === 0 && !mpError && (
        <Card>
          <div className="text-center py-8 text-text-muted">{t("marketplaceSkillsMpHint")}</div>
        </Card>
      )}
      {skillsProvider === "skillssh" && !shLoading && shResults.length === 0 && !shError && (
        <Card>
          <div className="text-center py-8 text-text-muted">{t("marketplaceSkillsShHint")}</div>
        </Card>
      )}
    </div>
  );
}

export default OmniMarketplaceTab;
