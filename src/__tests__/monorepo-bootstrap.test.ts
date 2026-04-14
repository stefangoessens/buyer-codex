import { env } from "@/lib/env";
import {
  authProviders,
  authSessionStates,
  deploymentStageDefinitions,
  dealStatuses,
  readEnv,
  railwayServiceDefinitions,
  webPublicEnvSpec,
  webServerEnvSpec,
  workspaceSurfaces,
} from "@buyer-codex/shared";
import { describe, expect, it } from "vitest";

describe("monorepo bootstrap", () => {
  it("documents major workspace boundaries in the shared config package", () => {
    expect(workspaceSurfaces.web.path).toBe(".");
    expect(workspaceSurfaces.backend.path).toBe("convex");
    expect(workspaceSurfaces.mobile.path).toBe("ios/BuyerCodex");
    expect(workspaceSurfaces.workers.path).toBe("python-workers");
    expect(workspaceSurfaces.extractionService.path).toBe("services/extraction");
    expect(railwayServiceDefinitions.web.configPath).toBe("railway.json");
    expect(railwayServiceDefinitions.extraction.configPath).toBe(
      "services/extraction/railway.json",
    );
    expect(railwayServiceDefinitions.extraction.buildWatchPatterns).toContain(
      "/python-workers/**",
    );
    expect(deploymentStageDefinitions.preview.persistent).toBe(false);
    expect(deploymentStageDefinitions.production.promoteFrom).toBe("staging");
  });

  it("shares public environment defaults through the config package", () => {
    const defaults = readEnv(webPublicEnvSpec, {});
    const serverDefaults = readEnv(webServerEnvSpec, {});

    expect(defaults.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(defaults.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(defaults.NEXT_PUBLIC_CONVEX_SITE_URL).toBe("");
    expect(defaults.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
    expect(serverDefaults.BETTER_AUTH_SECRET).toBe("");
    expect(serverDefaults.SITE_URL).toBe("");
    expect(env.NEXT_PUBLIC_CONVEX_URL).toBe("https://test.convex.cloud");
  });

  it("exposes stable shared contract unions", () => {
    expect(dealStatuses).toContain("offer_sent");
    expect(dealStatuses).toContain("under_contract");
    expect(authProviders).toContain("google");
    expect(authProviders).toContain("email");
    expect(authSessionStates).toContain("auth_unavailable");
  });
});
