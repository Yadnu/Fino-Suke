"use client";

import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────

type Step = "upload" | "map" | "preview" | "result";

interface ColumnMap {
  date: string;
  type: string;
  amount: string;
  category: string;
  notes: string;
  tags: string;
  isRecurring: string;
}

interface RowError {
  row: number;
  message: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: RowError[];
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

// ── CSV parser (mirrors server-side, for preview) ─────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") {
        row.push(field); field = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
      } else { field += ch; }
    }
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

// ── Required / optional field config ─────────────────────────────────

const REQUIRED_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type (expense/income)" },
  { key: "amount", label: "Amount" },
];

const OPTIONAL_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "notes", label: "Notes" },
  { key: "tags", label: "Tags" },
  { key: "isRecurring", label: "Recurring" },
];

const SKIP = "__skip__";

// ── Sub-components ────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ["upload", "map", "preview", "result"];
  const labels = ["Upload", "Map Columns", "Preview", "Done"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
              i < idx
                ? "bg-gold text-background"
                : i === idx
                ? "bg-gold/20 border border-gold text-gold"
                : "bg-accent text-muted"
            )}
          >
            {i < idx ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span
            className={cn(
              "text-xs",
              i === idx ? "text-foreground font-medium" : "text-muted"
            )}
          >
            {labels[i]}
          </span>
          {i < steps.length - 1 && (
            <div className="w-4 h-px bg-border mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export function CsvImportSheet({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({
    date: "",
    type: "",
    amount: "",
    category: SKIP,
    notes: SKIP,
    tags: SKIP,
    isRecurring: SKIP,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setColumnMap({
      date: "", type: "", amount: "",
      category: SKIP, notes: SKIP, tags: SKIP, isRecurring: SKIP,
    });
    setResult(null);
    setMapError(null);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  // ── Step 1: file selection ──

  function processFile(f: File) {
    if (!f.name.endsWith(".csv") && f.type !== "text/csv") {
      toast.error("Please select a .csv file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }
      const headers = rows[0].map((h) => h.trim());
      setParsed({ headers, rows: rows.slice(1) });
      setFile(f);

      // Auto-detect columns (case-insensitive, partial match)
      const autoMap = (keywords: string[]): string =>
        headers.find((h) =>
          keywords.some((k) => h.toLowerCase().includes(k))
        ) ?? "";
      const autoMapOpt = (keywords: string[]): string =>
        headers.find((h) =>
          keywords.some((k) => h.toLowerCase().includes(k))
        ) ?? SKIP;

      setColumnMap({
        date: autoMap(["date"]),
        type: autoMap(["type"]),
        amount: autoMap(["amount"]),
        category: autoMapOpt(["category", "cat"]),
        notes: autoMapOpt(["note", "description", "memo", "desc"]),
        tags: autoMapOpt(["tag"]),
        isRecurring: autoMapOpt(["recurring", "repeat"]),
      });

      setStep("map");
    };
    reader.readAsText(f);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  // ── Step 2: column mapping validation ──

  function validateMap(): boolean {
    for (const { key, label } of REQUIRED_FIELDS) {
      if (!columnMap[key]) {
        setMapError(`Please map the required field: ${label}`);
        return false;
      }
    }
    setMapError(null);
    return true;
  }

  // ── Step 3: import ──

  async function handleImport() {
    if (!file || !parsed) return;
    setIsImporting(true);

    try {
      const effectiveMap: Record<string, string> = {
        date: columnMap.date,
        type: columnMap.type,
        amount: columnMap.amount,
      };
      if (columnMap.category !== SKIP) effectiveMap.category = columnMap.category;
      if (columnMap.notes !== SKIP) effectiveMap.notes = columnMap.notes;
      if (columnMap.tags !== SKIP) effectiveMap.tags = columnMap.tags;
      if (columnMap.isRecurring !== SKIP) effectiveMap.isRecurring = columnMap.isRecurring;

      const fd = new FormData();
      fd.append("file", file);
      fd.append("columnMap", JSON.stringify(effectiveMap));

      const res = await fetch("/api/transactions/import", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }

      setResult(data as ImportResult);
      setStep("result");
      if ((data as ImportResult).imported > 0) {
        onImported();
      }
    } catch {
      toast.error("Import failed — please try again");
    } finally {
      setIsImporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent title="Import CSV" description="Import transactions from a CSV file">
        <StepIndicator step={step} />

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-gold bg-gold/5"
                  : "border-border hover:border-foreground/30 hover:bg-accent/30"
              )}
            >
              <Upload className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Drop a CSV file here
              </p>
              <p className="text-xs text-muted">or click to browse — max 5 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processFile(f);
                }}
              />
            </div>

            <div className="bg-accent/40 rounded-lg p-4 text-xs text-muted space-y-1.5">
              <p className="font-semibold text-foreground mb-2">Expected columns</p>
              <p><span className="text-foreground font-medium">Required:</span> date, type (expense/income), amount</p>
              <p><span className="text-foreground font-medium">Optional:</span> category, notes, tags (semicolon-separated), recurring (yes/no)</p>
              <p className="mt-2 pt-2 border-t border-border">Column headers can be in any order — you&apos;ll map them in the next step.</p>
            </div>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === "map" && parsed && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-muted bg-accent/40 rounded-md px-3 py-2">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium text-foreground">{file?.name}</span>
              <span className="shrink-0">&mdash; {parsed.rows.length} row{parsed.rows.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Required fields</p>
              {REQUIRED_FIELDS.map(({ key, label }) => (
                <FieldSelect
                  key={key}
                  label={label}
                  required
                  headers={parsed.headers}
                  value={columnMap[key]}
                  onChange={(v) => setColumnMap((m) => ({ ...m, [key]: v }))}
                />
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Optional fields</p>
              {OPTIONAL_FIELDS.map(({ key, label }) => (
                <FieldSelect
                  key={key}
                  label={label}
                  required={false}
                  headers={parsed.headers}
                  value={columnMap[key]}
                  onChange={(v) => setColumnMap((m) => ({ ...m, [key]: v }))}
                />
              ))}
            </div>

            {mapError && (
              <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {mapError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => { if (validateMap()) setStep("preview"); }}
                className="flex-1 flex items-center justify-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors"
              >
                Preview <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && parsed && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Importing <span className="font-semibold text-foreground">{parsed.rows.length}</span> transaction{parsed.rows.length !== 1 ? "s" : ""} — rows with validation errors will be skipped.
            </p>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/40">
                    {[
                      columnMap.date,
                      columnMap.type,
                      columnMap.amount,
                      ...(columnMap.category !== SKIP ? [columnMap.category] : []),
                      ...(columnMap.notes !== SKIP ? [columnMap.notes] : []),
                    ].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 8).map((row, i) => {
                    const get = (col: string) =>
                      row[parsed.headers.indexOf(col)] ?? "";
                    return (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/20">
                        {[
                          columnMap.date,
                          columnMap.type,
                          columnMap.amount,
                          ...(columnMap.category !== SKIP ? [columnMap.category] : []),
                          ...(columnMap.notes !== SKIP ? [columnMap.notes] : []),
                        ].map((h) => (
                          <td key={h} className="px-3 py-2 text-muted whitespace-nowrap max-w-[140px] truncate">
                            {get(h)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsed.rows.length > 8 && (
                <p className="text-xs text-muted text-center py-2 border-t border-border">
                  … and {parsed.rows.length - 8} more rows
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("map")}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex-1 flex items-center justify-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors disabled:opacity-60"
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                ) : (
                  <>Import {parsed.rows.length} row{parsed.rows.length !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && result && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-success">{result.imported}</p>
                <p className="text-xs text-muted mt-1">Imported</p>
              </div>
              <div className={cn(
                "border rounded-lg p-4 text-center",
                result.skipped > 0
                  ? "bg-danger/10 border-danger/20"
                  : "bg-accent/40 border-border"
              )}>
                <p className={cn("text-2xl font-bold", result.skipped > 0 ? "text-danger" : "text-muted")}>
                  {result.skipped}
                </p>
                <p className="text-xs text-muted mt-1">Skipped</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Row errors
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {result.errors.map((e) => (
                    <div
                      key={e.row}
                      className="flex gap-2 items-start text-xs bg-danger/5 border border-danger/15 rounded-md px-3 py-2"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                      <span>
                        <span className="font-semibold text-foreground">Row {e.row}:</span>{" "}
                        <span className="text-muted">{e.message}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.imported === 0 && result.skipped === 0 && (
              <p className="text-sm text-muted text-center">No rows were processed.</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={reset}
                className="flex-1 text-sm text-muted hover:text-foreground border border-border rounded-md py-2 transition-colors"
              >
                Import another file
              </button>
              <button
                onClick={() => handleClose(false)}
                className="flex-1 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── FieldSelect helper ────────────────────────────────────────────────

function FieldSelect({
  label,
  required,
  headers,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-foreground w-44 shrink-0 flex items-center gap-1">
        {label}
        {required && <span className="text-gold text-xs">*</span>}
      </label>
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "input-field appearance-none pr-8 text-sm w-full",
            !value || value === SKIP ? "text-muted" : "text-foreground"
          )}
        >
          {!required && (
            <option value={SKIP}>— skip —</option>
          )}
          {required && !value && (
            <option value="" disabled>Select a column…</option>
          )}
          {headers.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
