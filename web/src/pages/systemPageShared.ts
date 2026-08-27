import type { MemoryProviderInfo } from "@/lib/api";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type BackupImportTarget =
  | { kind: "upload"; file: File }
  | { kind: "path"; path: string };

export function backupImportLabel(target: BackupImportTarget | null): string {
  if (!target) return "the archive";
  return target.kind === "upload" ? target.file.name : target.path;
}

export function backupFileName(path: string | null): string {
  if (!path) return "No backup created yet";
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export const HOOK_EVENTS_FALLBACK = [
  "pre_tool_call",
  "post_tool_call",
  "pre_llm_call",
  "post_llm_call",
  "on_session_start",
  "on_session_end",
];

export const MEMORY_STATUS_LABEL: Record<MemoryProviderInfo["status"], string> = {
  ready: "ready",
  needs_config: "needs setup",
  unavailable: "unavailable",
  missing: "missing",
};

export const MEMORY_STATUS_TONE: Record<
  MemoryProviderInfo["status"],
  "success" | "warning" | "destructive" | "secondary"
> = {
  ready: "success",
  needs_config: "warning",
  unavailable: "destructive",
  missing: "destructive",
};
