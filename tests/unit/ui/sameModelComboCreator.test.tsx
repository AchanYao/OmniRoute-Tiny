import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SameModelComboCreator from "@/app/(dashboard)/dashboard/combos/SameModelComboCreator";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

describe("SameModelComboCreator", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  it("materializes an automatic same-ID aggregate for Combo configuration", async () => {
    const candidate = {
      modelId: "shared-model",
      providers: [
        { providerId: "openai", connectionCount: 2 },
        { providerId: "anthropic", connectionCount: 1 },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [candidate] }) })
    );
    const onCreate = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <SameModelComboCreator existingNames={[]} creating={false} onCreate={onCreate} />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Same-ID models already aggregate automatically");
    expect(container.textContent).toContain("shared-model");
    expect(container.textContent).toContain("openai · anthropic");
    expect(container.querySelector("select")).toBeNull();
    const button = Array.from(container.querySelectorAll("button")).find((entry) =>
      entry.textContent?.includes("Create & configure")
    );
    await act(async () => button?.click());

    expect(onCreate).toHaveBeenCalledWith(candidate);
  });

  it("omits model IDs that already have a named Combo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              modelId: "configured-model",
              providers: [
                { providerId: "openai", connectionCount: 1 },
                { providerId: "anthropic", connectionCount: 1 },
              ],
            },
          ],
        }),
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <SameModelComboCreator
          existingNames={["configured-model"]}
          creating={false}
          onCreate={() => {}}
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("No unconfigured same-ID models");
    expect(container.querySelector("select")).toBeNull();
  });
});
