import { expect, test, type Page, type Route } from "@playwright/test";
import { gotoDashboardRoute } from "./helpers/dashboardAuth";

const NAVIGATION_TIMEOUT_MS = 300_000;

type SkillRecord = {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  createdAt: string;
};

type MarketplaceSkill = {
  name: string;
  description: string;
  version: string;
  sourceUrl: string;
  skillMdContent: string;
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("Skills marketplace", () => {
  test.setTimeout(600_000);

  test("searches and scrolls through skills in the read-only dashboard", async ({ page }) => {
    const state: {
      skills: SkillRecord[];
      marketplace: MarketplaceSkill[];
    } = {
      skills: [
        {
          id: "skill-weather",
          name: "lookupWeather",
          version: "1.0.0",
          description: "Returns current weather conditions.",
          enabled: false,
          createdAt: new Date("2026-04-05T20:00:00.000Z").toISOString(),
        },
      ],
      marketplace: Array.from({ length: 12 }, (_, index) => ({
        name: index === 0 ? "Weather Pro" : `Skill Page ${index + 1}`,
        description:
          index === 0
            ? "Extended weather reports with severe alert support."
            : `Marketplace skill result ${index + 1}.`,
        version: `1.${index}.0`,
        sourceUrl: `https://skillsmp.example/${index + 1}`,
        skillMdContent: `# Skill ${index + 1}\n\nMarketplace content`,
      })),
    };

    await page.route(/\/api\/skills\/executions(?:\?.*)?$/, async (route) => {
      await fulfillJson(route, { data: [], total: 0, totalPages: 1 });
    });

    await page.route(/\/api\/skills\/marketplace(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q")?.toLowerCase() || "";
      const results = state.marketplace.filter((skill) =>
        query
          ? skill.name.toLowerCase().includes(query) ||
            skill.description.toLowerCase().includes(query)
          : true
      );
      await fulfillJson(route, { skills: results });
    });

    await page.route(/\/api\/skills(?:\?.*)?$/, async (route) => {
      await fulfillJson(route, {
        data: state.skills,
        total: state.skills.length,
        totalPages: 1,
      });
    });

    await gotoDashboardRoute(page, "/dashboard/omni-skills", {
      timeoutMs: NAVIGATION_TIMEOUT_MS,
    });

    await expect(page.getByText("lookupWeather")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /marketplace/i }).click();
    const marketplaceSearch = page.getByPlaceholder(/Search SkillsMP\.\.\./i);
    await expect(marketplaceSearch).toBeVisible({ timeout: 15000 });

    await marketplaceSearch.fill("weather");
    await page.getByRole("button", { name: /search skillsmp/i }).click();
    await expect(page.getByText("Weather Pro")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /install/i })).toHaveCount(0);
  });
});
