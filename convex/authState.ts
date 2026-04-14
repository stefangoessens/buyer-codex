import { query } from "./_generated/server";
import { v } from "convex/values";
import { readAuthCapabilities } from "./lib/authRuntime";
import {
  getSessionContext,
  sessionPermissionsValidator,
  sessionUserValidator,
} from "./lib/session";

const viewerSessionValidator = v.union(
  v.object({
    kind: v.literal("anonymous"),
  }),
  v.object({
    kind: v.literal("unknown_user"),
  }),
  v.object({
    kind: v.literal("authenticated"),
    user: sessionUserValidator,
    permissions: sessionPermissionsValidator,
  }),
);

export const getViewerSession = query({
  args: {},
  returns: viewerSessionValidator,
  handler: async (ctx) => {
    const session = await getSessionContext(ctx);

    if (session.kind === "anonymous") {
      return { kind: "anonymous" } as const;
    }

    if (session.kind === "unknown_user") {
      return { kind: "unknown_user" } as const;
    }

    return {
      kind: "authenticated",
      user: session.user,
      permissions: session.permissions,
    } as const;
  },
});

export const getCapabilities = query({
  args: {},
  returns: v.object({
    runtimeConfigured: v.boolean(),
    googleEnabled: v.boolean(),
    emailEnabled: v.boolean(),
    missingRuntimeEnv: v.array(v.string()),
    missingGoogleEnv: v.array(v.string()),
    missingEmailEnv: v.array(v.string()),
  }),
  handler: async () => readAuthCapabilities(),
});
