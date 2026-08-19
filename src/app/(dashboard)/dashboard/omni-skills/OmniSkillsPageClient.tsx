"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/shared/components";
import { SkillsConceptCard } from "@/shared/components";
import type { SkillsProvider } from "@/lib/skills/providerSettings";
import { OmniSkillsList } from "./components/OmniSkillsList";
import { OmniExecutionsTab } from "./components/OmniExecutionsTab";
import { OmniSandboxTab } from "./components/OmniSandboxTab";
import { OmniMarketplaceTab } from "./components/OmniMarketplaceTab";
import type { OmniSkill } from "./components/OmniSkillCard";

interface Execution {
  id: string;
  skillId: string;
  skillName: string;
  status: string;
  duration: number;
  createdAt: string;
}

export function OmniSkillsPageClient(): JSX.Element {
  const [skills, setSkills] = useState<OmniSkill[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillsPage, setSkillsPage] = useState(1);
  const [skillsTotal, setSkillsTotal] = useState(0);
  const [skillsTotalPages, setSkillsTotalPages] = useState(1);
  const [popularDefaults, setPopularDefaults] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "on" | "off" | "auto">("all");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const [execPage, setExecPage] = useState(1);
  const [execTotal, setExecTotal] = useState(0);
  const [execTotalPages, setExecTotalPages] = useState(1);

  const [activeTab, setActiveTab] = useState<"skills" | "executions" | "sandbox" | "marketplace">(
    "skills"
  );
  const [skillsProvider, setSkillsProvider] = useState<SkillsProvider>("skillsmp");

  const t = useTranslations("skills");
  // NOTE: commonT is intentionally unused here but retained for potential future use
  useTranslations("common");

  const fetchSkills = async (page: number) => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (modeFilter !== "all") params.set("mode", modeFilter);

    const res = await fetch(`/api/skills?${params.toString()}`).then((r) => r.json());
    setSkills((res as { data?: OmniSkill[] }).data || []);
    setSkillsTotal((res as { total?: number }).total || 0);
    setSkillsTotalPages((res as { totalPages?: number }).totalPages || 1);
    setPopularDefaults(
      Array.isArray((res as { popularDefaults?: string[] }).popularDefaults)
        ? (res as { popularDefaults: string[] }).popularDefaults
        : []
    );
  };

  const fetchExecutions = async (page: number) => {
    const res = await fetch(`/api/skills/executions?page=${page}&limit=20`).then((r) => r.json());
    setExecutions((res as { data?: Execution[] }).data || []);
    setExecTotal((res as { total?: number }).total || 0);
    setExecTotalPages((res as { totalPages?: number }).totalPages || 1);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/skills?page=1&limit=20").then((r) => r.json()),
      fetch("/api/skills/executions?page=1&limit=20").then((r) => r.json()),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([skillsData, executionsData, settingsData]) => {
        setSkills((skillsData as { data?: OmniSkill[] }).data || []);
        setSkillsTotal((skillsData as { total?: number }).total || 0);
        setSkillsTotalPages((skillsData as { totalPages?: number }).totalPages || 1);
        setPopularDefaults(
          Array.isArray((skillsData as { popularDefaults?: string[] }).popularDefaults)
            ? (skillsData as { popularDefaults: string[] }).popularDefaults
            : []
        );

        setExecutions((executionsData as { data?: Execution[] }).data || []);
        setExecTotal((executionsData as { total?: number }).total || 0);
        setExecTotalPages((executionsData as { totalPages?: number }).totalPages || 1);

        const sd = settingsData as { skillsProvider?: SkillsProvider } | null;
        if (sd?.skillsProvider === "skillsmp" || sd?.skillsProvider === "skillssh") {
          setSkillsProvider(sd.skillsProvider);
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-text-muted">{t("loading")}...</div>
      </div>
    );
  }

  const enabledCount = skills.filter((s) => s.enabled).length;
  const execSuccessCount = executions.filter((e) => e.status === "success").length;
  const successRate =
    executions.length > 0 ? Math.round((execSuccessCount / executions.length) * 100) : 0;

  const tabs: { id: "skills" | "executions" | "sandbox" | "marketplace"; labelKey: string }[] = [
    { id: "skills", labelKey: "skillsTab" },
    { id: "executions", labelKey: "executionsTab" },
    { id: "sandbox", labelKey: "sandboxTab" },
    { id: "marketplace", labelKey: "marketplaceTab" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Concept card */}
      <SkillsConceptCard variant="omni" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{t("totalSkills")}</p>
          <p className="text-2xl font-bold text-text-main mt-1">{skillsTotal}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{t("enabledSkills")}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{enabledCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{t("totalExecutions")}</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{execTotal}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{t("successRate")}</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{successRate}%</p>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(({ id, labelKey }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "skills" && (
        <OmniSkillsList
          skills={skills}
          skillsTotal={skillsTotal}
          skillsPage={skillsPage}
          skillsTotalPages={skillsTotalPages}
          popularDefaults={popularDefaults}
          searchTerm={searchTerm}
          modeFilter={modeFilter}
          selectedSkillId={selectedSkillId}
          onSearchTermChange={setSearchTerm}
          onModeFilterChange={setModeFilter}
          onApplyFilters={() => {
            setSkillsPage(1);
            void fetchSkills(1);
          }}
          onPagePrev={() => {
            const p = Math.max(1, skillsPage - 1);
            setSkillsPage(p);
            void fetchSkills(p);
          }}
          onPageNext={() => {
            const p = Math.min(skillsTotalPages, skillsPage + 1);
            setSkillsPage(p);
            void fetchSkills(p);
          }}
          onSelectSkill={setSelectedSkillId}
        />
      )}

      {activeTab === "executions" && (
        <OmniExecutionsTab
          executions={executions}
          execPage={execPage}
          execTotalPages={execTotalPages}
          execTotal={execTotal}
          onPagePrev={() => {
            const p = Math.max(1, execPage - 1);
            setExecPage(p);
            void fetchExecutions(p);
          }}
          onPageNext={() => {
            const p = Math.min(execTotalPages, execPage + 1);
            setExecPage(p);
            void fetchExecutions(p);
          }}
        />
      )}

      {activeTab === "sandbox" && <OmniSandboxTab />}

      {activeTab === "marketplace" && <OmniMarketplaceTab skillsProvider={skillsProvider} />}
    </div>
  );
}

export default OmniSkillsPageClient;
