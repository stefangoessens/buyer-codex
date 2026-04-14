import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, components } from "./_generated/api";
import { authProvider } from "./lib/validators";
import {
  normalizeAuthProviderHint,
  getSessionContext,
  inferAuthProviderFromIssuer,
  requireAuth,
  sessionUserValidator,
} from "./lib/session";
import { authComponent } from "./auth";

const authProviderHintValidator = v.optional(authProvider);

async function resolveCurrentAuthUser(ctx: MutationCtx) {
  return await authComponent.getAuthUser(ctx);
}

async function resolveCurrentAuthProvider(
  ctx: MutationCtx,
  authProviderHint?: "google" | "email" | "clerk" | "auth0",
) {
  const session = await getSessionContext(ctx);
  if (session.kind === "anonymous") {
    return undefined;
  }

  const accounts = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "account",
    where: [{ field: "userId", value: session.identity.subject }],
    paginationOpts: {
      cursor: null,
      numItems: 10,
    },
  });

  for (const account of accounts.page) {
    const normalized = normalizeAuthProviderHint(account.providerId);
    if (normalized) {
      return normalized;
    }
  }

  return authProviderHint ?? inferAuthProviderFromIssuer(session.identity.issuer);
}

async function buildIdentityPatch(
  ctx: MutationCtx,
  authProviderHint?: "google" | "email" | "clerk" | "auth0",
  overrides?: {
    phone?: string;
    avatarUrl?: string;
  },
) {
  const session = await getSessionContext(ctx);
  if (session.kind === "anonymous") {
    throw new Error("Authentication required");
  }

  const authUser = await resolveCurrentAuthUser(ctx);
  const authProvider = await resolveCurrentAuthProvider(ctx, authProviderHint);
  const now = new Date().toISOString();

  return {
    session,
    authUser,
    patch: {
      email: authUser.email,
      name: authUser.name || authUser.email,
      avatarUrl: overrides?.avatarUrl ?? authUser.image ?? undefined,
      phone: overrides?.phone,
      authProvider,
      authIssuer: session.identity.issuer,
      authSubject: session.identity.subject,
      authTokenIdentifier: session.identity.tokenIdentifier,
      sessionVersion: 1,
      lastAuthenticatedAt: now,
    },
  };
}

export const get = query({
  args: { userId: v.id("users") },
  returns: v.union(sessionUserValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(sessionUserValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

// User creation is internal-only — called by auth hooks, not by clients directly.
// This prevents privilege escalation via caller-supplied roles.
export const create = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("buyer"), v.literal("broker"), v.literal("admin")),
    phone: v.optional(v.string()),
    authProvider: v.optional(authProvider),
    authIssuer: v.optional(v.string()),
    authSubject: v.optional(v.string()),
    authTokenIdentifier: v.optional(v.string()),
    sessionVersion: v.optional(v.number()),
    lastAuthenticatedAt: v.optional(v.string()),
    attributionSessionId: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      role: args.role,
      phone: args.phone,
      authProvider: args.authProvider,
      authIssuer: args.authIssuer,
      authSubject: args.authSubject,
      authTokenIdentifier: args.authTokenIdentifier,
      sessionVersion: args.sessionVersion ?? (args.authSubject ? 1 : undefined),
      lastAuthenticatedAt: args.lastAuthenticatedAt,
    });

    if (args.attributionSessionId) {
      await ctx.runMutation(api.leadAttribution.handoffToUser, {
        sessionId: args.attributionSessionId,
        userId,
      });
    }

    return userId;
  },
});

export const bindAuthIdentity = internalMutation({
  args: {
    userId: v.id("users"),
    authProvider: v.optional(authProvider),
    authIssuer: v.string(),
    authSubject: v.string(),
    authTokenIdentifier: v.string(),
    sessionVersion: v.optional(v.number()),
    lastAuthenticatedAt: v.optional(v.string()),
    attributionSessionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      authProvider: args.authProvider,
      authIssuer: args.authIssuer,
      authSubject: args.authSubject,
      authTokenIdentifier: args.authTokenIdentifier,
      sessionVersion: args.sessionVersion ?? 1,
      lastAuthenticatedAt: args.lastAuthenticatedAt ?? new Date().toISOString(),
    });

    if (args.attributionSessionId) {
      await ctx.runMutation(api.leadAttribution.handoffToUser, {
        sessionId: args.attributionSessionId,
        userId: args.userId,
      });
    }

    return null;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Enforce ownership — users can only update their own profile
    const currentUser = await requireAuth(ctx);

    const patch: Record<string, string> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.avatarUrl !== undefined) patch.avatarUrl = args.avatarUrl;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(currentUser._id, patch);
    }
    return null;
  },
});

/**
 * Ensure the current authenticated identity is bound to a buyer row in Convex.
 *
 * Web onboarding uses this right after Better Auth sign-in: if the identity is new,
 * we create a buyer row; if it already exists (or matches by email), we bind
 * the auth fields and refresh the presentation fields. This keeps onboarding
 * flows resumable without exposing a public arbitrary user-creation endpoint.
 */
export const ensureCurrentBuyer = mutation({
  args: {
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    attributionSessionId: v.optional(v.string()),
    authProviderHint: authProviderHintValidator,
  },
  returns: sessionUserValidator,
  handler: async (ctx, args) => {
    const { session, authUser, patch } = await buildIdentityPatch(
      ctx,
      args.authProviderHint,
      {
        phone: args.phone,
        avatarUrl: args.avatarUrl,
      },
    );

    const bindUser = async (userId: Id<"users">) => {
      await ctx.db.patch(userId, patch);

      if (args.attributionSessionId) {
        await ctx.runMutation(api.leadAttribution.handoffToUser, {
          sessionId: args.attributionSessionId,
          userId,
        });
      }

      const row = await ctx.db.get(userId);
      if (!row) {
        throw new Error("User not found after binding auth identity");
      }
      return row;
    };

    if (session.kind === "authenticated") {
      return await bindUser(session.user._id);
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", authUser.email))
      .unique();

    if (existingByEmail) {
      return await bindUser(existingByEmail._id);
    }

    const userId = await ctx.db.insert("users", {
      role: "buyer",
      ...patch,
    });

    if (args.attributionSessionId) {
      await ctx.runMutation(api.leadAttribution.handoffToUser, {
        sessionId: args.attributionSessionId,
        userId,
      });
    }

    const created = await ctx.db.get(userId);
    if (!created) {
      throw new Error("User not found after creation");
    }
    return created;
  },
});

export const syncCurrentIdentity = mutation({
  args: {
    authProviderHint: authProviderHintValidator,
  },
  returns: v.union(sessionUserValidator, v.null()),
  handler: async (ctx, args) => {
    const { session, authUser, patch } = await buildIdentityPatch(ctx, args.authProviderHint);

    if (session.kind === "authenticated") {
      await ctx.db.patch(session.user._id, patch);
      return await ctx.db.get(session.user._id);
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", authUser.email))
      .unique();

    if (!existingByEmail) {
      return null;
    }

    await ctx.db.patch(existingByEmail._id, patch);
    return await ctx.db.get(existingByEmail._id);
  },
});
