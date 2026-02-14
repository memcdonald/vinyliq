"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Step = "upload" | "map" | "preview";

const SOURCE_FIELDS = [
  { key: "priority", label: "Priority", required: true },
  { key: "sourceName", label: "Source Name", required: true },
  { key: "url", label: "URL", required: false },
  { key: "category", label: "Category", required: false },
  { key: "pulseUse", label: "Pulse Use", required: false },
  { key: "accessMethod", label: "Access Method", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

type FieldKey = (typeof SOURCE_FIELDS)[number]["key"];
type ColumnMapping = Partial<Record<FieldKey, string>>;

export function CsvImportDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const utils = trpc.useUtils();
  const bulkMutation = trpc.sources.bulkAddSources.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.count} sources`);
      utils.sources.getAll.invalidate();
      handleClose();
    },
    onError: (error) => {
      toast.error("Import failed", { description: error.message });
    },
  });

  function handleClose() {
    setOpen(false);
    setStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
  }

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.meta.fields?.length || results.data.length === 0) {
            toast.error("CSV appears empty or has no headers");
            return;
          }
          setCsvHeaders(results.meta.fields);
          setCsvRows(results.data);

          // Auto-map columns by fuzzy-matching header names
          const autoMap: ColumnMapping = {};
          for (const field of SOURCE_FIELDS) {
            const match = results.meta.fields.find((h) => {
              const normalized = h.toLowerCase().replace(/[_\s-]/g, "");
              const fieldNormalized = field.key.toLowerCase();
              const labelNormalized = field.label.toLowerCase().replace(/\s/g, "");
              return normalized === fieldNormalized || normalized === labelNormalized;
            });
            if (match) autoMap[field.key] = match;
          }
          setMapping(autoMap);
          setStep("map");
        },
        error: (err) => {
          toast.error("Failed to parse CSV", { description: err.message });
        },
      });

      // Reset file input so the same file can be re-selected
      e.target.value = "";
    },
    [],
  );

  const requiredMapped = SOURCE_FIELDS.filter((f) => f.required).every(
    (f) => mapping[f.key],
  );

  function buildSources() {
    return csvRows
      .map((row) => ({
        priority: mapping.priority ? row[mapping.priority]?.trim() ?? "" : "",
        sourceName: mapping.sourceName ? row[mapping.sourceName]?.trim() ?? "" : "",
        url: mapping.url ? row[mapping.url]?.trim() || undefined : undefined,
        category: mapping.category ? row[mapping.category]?.trim() || undefined : undefined,
        pulseUse: mapping.pulseUse ? row[mapping.pulseUse]?.trim() || undefined : undefined,
        accessMethod: mapping.accessMethod ? row[mapping.accessMethod]?.trim() || undefined : undefined,
        notes: mapping.notes ? row[mapping.notes]?.trim() || undefined : undefined,
      }))
      .filter((s) => s.priority && s.sourceName);
  }

  const previewSources = step === "preview" ? buildSources() : [];

  function handleImport() {
    const sources = buildSources();
    if (sources.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    bulkMutation.mutate({ sources });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-1 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {step === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Sources from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file with your data sources. You&apos;ll map columns in the next step.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-8">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent">
                  Choose CSV file
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                CSV should have a header row with column names
              </p>
            </div>
          </>
        )}

        {step === "map" && (
          <>
            <DialogHeader>
              <DialogTitle>Map Columns</DialogTitle>
              <DialogDescription>
                Match your CSV columns to source fields. * indicates required fields.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {SOURCE_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="w-36 shrink-0 text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </label>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: e.target.value || undefined,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">-- Skip --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {csvRows.length} rows detected in CSV
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                disabled={!requiredMapped}
                onClick={() => setStep("preview")}
              >
                Preview
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "preview" && (
          <>
            <DialogHeader>
              <DialogTitle>Preview Import</DialogTitle>
              <DialogDescription>
                {previewSources.length} valid sources will be imported.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Priority</th>
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 font-medium">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {previewSources.slice(0, 5).map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-4">{s.priority}</td>
                      <td className="py-1.5 pr-4">{s.sourceName}</td>
                      <td className="py-1.5 pr-4">{s.category ?? "—"}</td>
                      <td className="py-1.5 max-w-[200px] truncate">{s.url ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewSources.length > 5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  ...and {previewSources.length - 5} more
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" size="sm" onClick={() => setStep("map")}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={bulkMutation.isPending || previewSources.length === 0}
              >
                {bulkMutation.isPending
                  ? "Importing..."
                  : `Import ${previewSources.length} Sources`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
