function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";
const DEFAULT_DEV_SECRET = "buyer-codex-dev-better-auth-secret";

function readSiteUrl() {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    DEFAULT_LOCAL_SITE_URL
  );
}

export function readAuthCapabilities() {
  const runtimeConfigured =
    hasValue(process.env.BETTER_AUTH_SECRET) && hasValue(process.env.SITE_URL);
  const googleCredentialsPresent =
    hasValue(process.env.GOOGLE_CLIENT_ID) &&
    hasValue(process.env.GOOGLE_CLIENT_SECRET);
  const emailDeliveryConfigured =
    hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.AUTH_EMAIL_FROM);

  return {
    runtimeConfigured,
    googleEnabled: runtimeConfigured && googleCredentialsPresent,
    emailEnabled: runtimeConfigured && emailDeliveryConfigured,
    missingRuntimeEnv: [
      hasValue(process.env.BETTER_AUTH_SECRET) ? null : "BETTER_AUTH_SECRET",
      hasValue(process.env.SITE_URL) ? null : "SITE_URL",
    ].filter((value): value is string => value !== null),
    missingGoogleEnv: [
      hasValue(process.env.GOOGLE_CLIENT_ID) ? null : "GOOGLE_CLIENT_ID",
      hasValue(process.env.GOOGLE_CLIENT_SECRET) ? null : "GOOGLE_CLIENT_SECRET",
    ].filter((value): value is string => value !== null),
    missingEmailEnv: [
      hasValue(process.env.RESEND_API_KEY) ? null : "RESEND_API_KEY",
      hasValue(process.env.AUTH_EMAIL_FROM) ? null : "AUTH_EMAIL_FROM",
    ].filter((value): value is string => value !== null),
  };
}

export function readAuthRuntimeConfig() {
  const capabilities = readAuthCapabilities();

  return {
    ...capabilities,
    siteUrl: readSiteUrl(),
    secret: process.env.BETTER_AUTH_SECRET ?? DEFAULT_DEV_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    authEmailFrom: process.env.AUTH_EMAIL_FROM ?? "",
  };
}
