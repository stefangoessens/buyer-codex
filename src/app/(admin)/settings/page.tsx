"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { AdminShell, type AdminShellSession } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { PromptRegistrySettings } from "@/components/admin/PromptRegistrySettings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatConsoleTimestamp, pluralize } from "@/lib/admin/format";
import {
  SETTINGS_CATALOG,
  canWriteSetting,
  findCatalogEntry,
  validateSettingValue,
} from "@/lib/settings/logic";
import type {
  SettingCategory,
  SettingValidationError,
  SettingValue,
  SettingValueKind,
} from "@/lib/settings/types";
import { cn } from "@/lib/utils";

interface SettingsListEntry {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  kind: SettingValueKind;
  writeRole: "admin" | "broker";
  currentJson: unknown;
  isDefault: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface SettingsAuditEntry {
  key: string;
  previousKind?: SettingValueKind;
  previousJson?: unknown;
  nextKind: SettingValueKind;
  nextJson: unknown;
  changedBy: string;
  reason: string;
  changedAt: string;
}

interface UpsertSettingArgs extends Record<string, unknown> {
  key: string;
  kind: SettingValueKind;
  stringValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  richTextValue?: string;
  jsonValue?: Record<string, unknown>;
  reason: string;
}

type DraftParseResult =
  | { ok: true; value: SettingValue }
  | { ok: false; message: string };

const CATEGORY_ORDER: SettingCategory[] = [
  "disclosures",
  "fees",
  "rollout",
  "operational",
  "branding",
];

const CATEGORY_META: Record<
  SettingCategory,
  { label: string; description: string }
> = {
  disclosures: {
    label: "Disclosures",
    description: "Buyer-facing legal copy and compliance text.",
  },
  fees: {
    label: "Fee defaults",
    description: "Pricing assumptions and operational credit thresholds.",
  },
  rollout: {
    label: "Rollout flags",
    description: "Runtime feature switches for buyer-facing flows.",
  },
  operational: {
    label: "Operational defaults",
    description: "Support and review settings used by ops tooling.",
  },
  branding: {
    label: "Branding",
    description: "Site-wide display values surfaced across marketing pages.",
  },
};

const KIND_LABELS: Record<SettingValueKind, string> = {
  string: "Text",
  number: "Number",
  boolean: "Boolean",
  richText: "Rich text",
  json: "JSON",
};

const settingsApi = (
  api as unknown as {
    settings: {
      listAll: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        SettingsListEntry[]
      >;
      upsertByKey: FunctionReference<
        "mutation",
        "public",
        UpsertSettingArgs,
        unknown
      >;
      listAuditForKey: FunctionReference<
        "query",
        "public",
        { key: string; limit?: number },
        SettingsAuditEntry[]
      >;
    };
  }
).settings;

export default function SettingsPage() {
  return (
    <AdminShell>
      <SettingsContent />
    </AdminShell>
  );
}

function SettingsContent() {
  const session = useQuery(api.adminShell.getCurrentSession) as
    | AdminShellSession
    | null
    | undefined;
  const settings = useQuery(settingsApi.listAll) as
    | SettingsListEntry[]
    | undefined;
  const saveSetting = useMutation(settingsApi.upsertByKey);

  const [selectedKey, setSelectedKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!settings?.length) return;
    if (selectedKey && settings.some((setting) => setting.key === selectedKey)) {
      return;
    }
    const firstKey = settings[0]?.key;
    if (firstKey) {
      setSelectedKey(firstKey);
    }
  }, [selectedKey, settings]);

  const groupedSettings = useMemo(() => {
    const groups = new Map<
      SettingCategory,
      {
        category: SettingCategory;
        label: string;
        description: string;
        entries: SettingsListEntry[];
      }
    >();

    for (const category of CATEGORY_ORDER) {
      groups.set(category, {
        category,
        label: CATEGORY_META[category].label,
        description: CATEGORY_META[category].description,
        entries: [],
      });
    }

    for (const setting of settings ?? []) {
      groups.get(setting.category)?.entries.push(setting);
    }

    return CATEGORY_ORDER.map((category) => groups.get(category)!);
  }, [settings]);

  const selectedSetting = useMemo(
    () => settings?.find((setting) => setting.key === selectedKey) ?? null,
    [selectedKey, settings]
  );

  const liveValue = useMemo(
    () => (selectedSetting ? coerceStoredValue(selectedSetting) : null),
    [selectedSetting]
  );

  const catalogEntry = selectedSetting
    ? findCatalogEntry(SETTINGS_CATALOG, selectedSetting.key)
    : undefined;

  useEffect(() => {
    if (!selectedSetting || !liveValue) return;
    setDraftValue(formatDraftValue(liveValue));
    setReason("");
    setError(null);
    setSuccess(null);
  }, [selectedSetting?.key]);

  const draftParse = useMemo(
    () => (selectedSetting ? parseDraftValue(selectedSetting.kind, draftValue) : null),
    [draftValue, selectedSetting]
  );

  const clientValidation = useMemo(() => {
    if (!selectedSetting || !draftParse?.ok) return null;
    return validateSettingValue(selectedSetting.key, draftParse.value);
  }, [draftParse, selectedSetting]);

  const audit = useQuery(
    settingsApi.listAuditForKey,
    selectedSetting ? { key: selectedSetting.key, limit: 6 } : "skip"
  ) as SettingsAuditEntry[] | undefined;

  const initialDraft = liveValue ? formatDraftValue(liveValue) : "";
  const isDirty = selectedSetting !== null && draftValue !== initialDraft;
  const validationMessages = getValidationMessages(draftParse, clientValidation);
  const canWriteSelected =
    selectedSetting && session?.user.role
      ? canWriteSetting(selectedSetting.key, session.user.role).ok
      : false;

  const stats = useMemo(() => {
    const total = settings?.length ?? 0;
    const brokerWritable =
      settings?.filter((setting) => setting.writeRole === "broker").length ?? 0;
    const defaultBacked = settings?.filter((setting) => setting.isDefault).length ?? 0;
    return { total, brokerWritable, defaultBacked };
  }, [settings]);

  const handleReset = () => {
    if (!liveValue) return;
    setDraftValue(formatDraftValue(liveValue));
    setReason("");
    setError(null);
    setSuccess(null);
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSetting) {
      setError("Select a setting to edit.");
      return;
    }
    if (!canWriteSelected) {
      setError("You do not have permission to publish this setting.");
      return;
    }
    if (!draftParse?.ok) {
      setError(draftParse?.message ?? "Fix the draft value before publishing.");
      return;
    }
    if (clientValidation && !clientValidation.ok) {
      setError("Fix the validation errors before publishing.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Reason is required and must be at least 3 characters.");
      return;
    }
    if (!isDirty) {
      setError("No changes to publish.");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await saveSetting(buildMutationArgs(selectedSetting.key, draftParse.value, reason));
        setSuccess(`${selectedSetting.label} published.`);
        setReason("");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to publish the setting."
        );
      }
    });
  };

  if (session === undefined || settings === undefined) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Settings"
          title="Internal settings"
          description="Brokerage disclosures, fee defaults, rollout flags, and operational runtime controls."
        />
        <AdminEmptyState
          title="Loading settings…"
          description="Fetching the settings catalog, current values, and access controls."
        />
      </>
    );
  }

  if (session === null || session.user.role !== "admin") {
    return (
      <>
        <AdminPageHeader
          eyebrow="Settings"
          title="Internal settings"
          description="Brokerage disclosures, fee defaults, rollout flags, and operational runtime controls."
        />
        <AdminEmptyState
          title="Not authorized"
          description="Only admins can publish internal runtime settings."
        />
      </>
    );
  }

  if (!settings.length) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Settings"
          title="Internal settings"
          description="Brokerage disclosures, fee defaults, rollout flags, and operational runtime controls."
        />
        <AdminEmptyState
          title="No supported settings"
          description="The mutable settings catalog is empty."
        />
      </>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Settings"
        title="Internal settings"
        description="Typed runtime configuration for brokerage copy, fee defaults, rollout flags, and operational thresholds. Every publish is validated and auditable."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Catalog entries"
          value={stats.total}
          description={pluralize(stats.total, "setting")}
        />
        <SummaryCard
          label="Broker-writable"
          value={stats.brokerWritable}
          description="Subset that future broker tooling can update without admin escalation."
        />
        <SummaryCard
          label="Using defaults"
          value={stats.defaultBacked}
          description="Entries still resolved from the catalog default."
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
        <div className="space-y-4">
          {groupedSettings.map((group) => (
            <Card key={group.category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{group.label}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.entries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-500">
                    No settings in this category.
                  </div>
                ) : (
                  group.entries.map((setting) => {
                    const isSelected = setting.key === selectedSetting?.key;
                    return (
                      <button
                        key={setting.key}
                        type="button"
                        onClick={() => setSelectedKey(setting.key)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                          isSelected
                            ? "border-primary-500 bg-primary-50"
                            : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-neutral-900">
                            {setting.label}
                          </div>
                          <Badge variant="outline">{KIND_LABELS[setting.kind]}</Badge>
                          <Badge variant="secondary">
                            {setting.writeRole === "admin" ? "Admin only" : "Broker-safe"}
                          </Badge>
                          {setting.isDefault ? (
                            <Badge variant="outline">Default</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-neutral-600">
                          {setting.description}
                        </p>
                        <div className="mt-2 text-xs text-neutral-500">
                          {setting.isDefault
                            ? "Using catalog default"
                            : `Published ${formatConsoleTimestamp(setting.updatedAt)} by ${setting.updatedBy}`}
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">
                    {selectedSetting?.label ?? "Select a setting"}
                  </CardTitle>
                  <CardDescription>
                    {selectedSetting?.description ??
                      "Choose a setting from the catalog to view and edit it."}
                  </CardDescription>
                </div>
                {selectedSetting ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{KIND_LABELS[selectedSetting.kind]}</Badge>
                    <Badge variant="secondary">
                      {selectedSetting.writeRole === "admin" ? "Admin only" : "Broker-safe"}
                    </Badge>
                    {selectedSetting.isDefault ? (
                      <Badge variant="outline">Default value active</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {selectedSetting && liveValue ? (
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InfoPanel
                      label="Current live value"
                      value={formatPreviewValue(liveValue)}
                    />
                    <InfoPanel
                      label="Catalog default"
                      value={
                        catalogEntry
                          ? formatPreviewValue(catalogEntry.defaultValue)
                          : "Default value unavailable"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Draft value
                    </div>
                    <SettingEditor
                      kind={selectedSetting.kind}
                      value={draftValue}
                      onChange={setDraftValue}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                      <span>
                        Validation runs client-side before publish and again in Convex before the
                        write lands.
                      </span>
                      {!canWriteSelected ? (
                        <span>This setting is not writable for your role.</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="settings-reason"
                      className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      Publish reason
                    </label>
                    <textarea
                      id="settings-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Explain why this change is necessary. This is stored in the audit log."
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <div className="text-right text-[11px] text-neutral-400">
                      {reason.length} / 500
                    </div>
                  </div>

                  {validationMessages.length > 0 ? (
                    <div className="rounded-lg border border-error-500/30 bg-error-50 px-4 py-3 text-sm text-error-700">
                      <div className="font-medium">Fix before publishing</div>
                      <ul className="mt-2 space-y-1">
                        {validationMessages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-lg border border-error-500/30 bg-error-50 px-4 py-3 text-sm text-error-700">
                      {error}
                    </div>
                  ) : null}

                  {success ? (
                    <div className="rounded-lg border border-success-500/30 bg-success-50 px-4 py-3 text-sm text-success-700">
                      {success}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
                    <div className="text-xs text-neutral-500">
                      {selectedSetting.isDefault
                        ? "No custom value has been published yet."
                        : `Last changed ${formatConsoleTimestamp(selectedSetting.updatedAt)} by ${selectedSetting.updatedBy}.`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" onClick={handleReset}>
                        Reset draft
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          isPending ||
                          !canWriteSelected ||
                          !isDirty ||
                          validationMessages.length > 0
                        }
                      >
                        {isPending ? "Publishing…" : "Publish setting"}
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <AdminEmptyState
                  title="Setting unavailable"
                  description="The selected entry could not be decoded from the typed catalog."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent audit history</CardTitle>
              <CardDescription>
                Every publish records the actor, reason, and before/after values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {audit === undefined ? (
                <AdminEmptyState
                  title="Loading audit log…"
                  description="Fetching recent changes for the selected setting."
                />
              ) : audit.length === 0 ? (
                <AdminEmptyState
                  title="No published changes yet"
                  description="This setting is currently using its catalog default."
                />
              ) : (
                <div className="space-y-3">
                  {audit.map((entry) => (
                    <div
                      key={`${entry.key}-${entry.changedAt}-${entry.changedBy}`}
                      className="rounded-xl border border-neutral-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-neutral-900">
                          {entry.changedBy}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {formatConsoleTimestamp(entry.changedAt)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-neutral-600">{entry.reason}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <AuditValueCard
                          label="Previous"
                          kind={entry.previousKind}
                          value={entry.previousJson}
                        />
                        <AuditValueCard
                          label="Published"
                          kind={entry.nextKind}
                          value={entry.nextJson}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Prompt registry
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Prompt version visibility remains on this route, but runtime brokerage
                settings now live in the typed editor above.
              </p>
            </div>
            <PromptRegistrySettings />
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-neutral-500">{description}</CardContent>
    </Card>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-700">
        {value}
      </pre>
    </div>
  );
}

function AuditValueCard({
  label,
  kind,
  value,
}: {
  label: string;
  kind?: SettingValueKind;
  value: unknown;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </div>
        {kind ? <Badge variant="outline">{KIND_LABELS[kind]}</Badge> : null}
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-700">
        {formatUnknownValue(value)}
      </pre>
    </div>
  );
}

function SettingEditor({
  kind,
  value,
  onChange,
}: {
  kind: SettingValueKind;
  value: string;
  onChange: (value: string) => void;
}) {
  if (kind === "boolean") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (kind === "number") {
    return (
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={kind === "richText" || kind === "json" ? 10 : 4}
      spellCheck={kind !== "json"}
      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
    />
  );
}

function coerceStoredValue(setting: SettingsListEntry): SettingValue | null {
  switch (setting.kind) {
    case "string":
      return typeof setting.currentJson === "string"
        ? { kind: "string", value: setting.currentJson }
        : null;
    case "number":
      return typeof setting.currentJson === "number"
        ? { kind: "number", value: setting.currentJson }
        : null;
    case "boolean":
      return typeof setting.currentJson === "boolean"
        ? { kind: "boolean", value: setting.currentJson }
        : null;
    case "richText":
      return typeof setting.currentJson === "string"
        ? { kind: "richText", value: setting.currentJson }
        : null;
    case "json":
      return isJsonObject(setting.currentJson)
        ? { kind: "json", value: setting.currentJson }
        : null;
  }
}

function parseDraftValue(kind: SettingValueKind, draft: string): DraftParseResult {
  switch (kind) {
    case "string":
      return { ok: true, value: { kind, value: draft } };
    case "richText":
      return { ok: true, value: { kind, value: draft } };
    case "boolean":
      if (draft === "true" || draft === "false") {
        return { ok: true, value: { kind, value: draft === "true" } };
      }
      return { ok: false, message: "Boolean settings must be true or false." };
    case "number": {
      if (!draft.trim()) {
        return { ok: false, message: "Enter a numeric value." };
      }
      const value = Number(draft);
      if (Number.isNaN(value)) {
        return { ok: false, message: "Enter a valid number." };
      }
      return { ok: true, value: { kind, value } };
    }
    case "json": {
      if (!draft.trim()) {
        return { ok: false, message: "Enter a JSON object." };
      }
      try {
        const parsed = JSON.parse(draft);
        if (!isJsonObject(parsed)) {
          return { ok: false, message: "JSON settings must be an object." };
        }
        return { ok: true, value: { kind, value: parsed } };
      } catch {
        return { ok: false, message: "Draft is not valid JSON." };
      }
    }
  }
}

function formatDraftValue(value: SettingValue): string {
  switch (value.kind) {
    case "string":
    case "richText":
      return value.value;
    case "number":
      return String(value.value);
    case "boolean":
      return value.value ? "true" : "false";
    case "json":
      return JSON.stringify(value.value, null, 2);
  }
}

function formatPreviewValue(value: SettingValue): string {
  switch (value.kind) {
    case "json":
      return JSON.stringify(value.value, null, 2);
    case "boolean":
      return value.value ? "true" : "false";
    case "number":
      return String(value.value);
    case "string":
    case "richText":
      return value.value;
  }
}

function formatUnknownValue(value: unknown): string {
  if (value === undefined) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function getValidationMessages(
  draftParse: DraftParseResult | null,
  validation:
    | ReturnType<typeof validateSettingValue>
    | null
): string[] {
  if (draftParse && !draftParse.ok) {
    return [draftParse.message];
  }
  if (!validation || validation.ok) {
    return [];
  }
  return validation.errors.map(formatValidationError);
}

function formatValidationError(error: SettingValidationError): string {
  switch (error.kind) {
    case "unknownKey":
      return "This setting is no longer part of the supported catalog.";
    case "kindMismatch":
      return `Expected ${KIND_LABELS[error.expected]} input, got ${KIND_LABELS[error.actual]}.`;
    case "stringTooShort":
      return `Value must be at least ${error.min} characters.`;
    case "stringTooLong":
      return `Value must be at most ${error.max} characters.`;
    case "patternMismatch":
      return `Value does not match the required format ${error.pattern}.`;
    case "invalidCatalogPattern":
      return `Catalog pattern is invalid: ${error.pattern}.`;
    case "numberOutOfRange":
      return `Value must be between ${error.min ?? "-∞"} and ${error.max ?? "∞"}.`;
    case "notAnInteger":
      return "Value must be a whole number.";
    case "notANumber":
      return "Value must be numeric.";
    case "missingRequiredJsonKey":
      return `JSON must include the key "${error.missingKey}".`;
  }
}

function buildMutationArgs(key: string, value: SettingValue, reason: string) {
  return {
    key,
    kind: value.kind,
    stringValue: value.kind === "string" ? value.value : undefined,
    numberValue: value.kind === "number" ? value.value : undefined,
    booleanValue: value.kind === "boolean" ? value.value : undefined,
    richTextValue: value.kind === "richText" ? value.value : undefined,
    jsonValue: value.kind === "json" ? value.value : undefined,
    reason: reason.trim(),
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
