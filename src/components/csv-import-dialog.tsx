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

const RELEASE_FIELDS = [
  { key: "title", label: "Title", required: true },
  { key: "artistName", label: "Artist", required: true },
  { key: "labelName", label: "Label", required: false },
  { key: "releaseDate", label: "Release Date", required: false },
  { key: "orderUrl", label: "Order URL", required: false },
  { key: "pressRun", label: "Press Run", required: false },
  { key: "coloredVinyl", label: "Colored Vinyl", required: false },
  { key: "numbered", label: "Numbered", required: false },
  { key: "specialPackaging", label: "Special Packaging", required: false },
] as const;

type FieldKey = (typeof RELEASE_FIELDS)[number]["key"];
type ColumnMapping = Partial<Record<FieldKey, string>>;

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return ["true", "yes", "1", "y", "x"].includes(v);
}

export function CsvImportDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const utils = trpc.useUtils();
  const bulkMutation = trpc.releases.bulkAddReleases.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.count} releases`);
      utils.releases.getUpcoming.invalidate();
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
          for (const field of RELEASE_FIELDS) {
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

  const requiredMapped = RELEASE_FIELDS.filter((f) => f.required).every(
    (f) => mapping[f.key],
  );

  function buildReleases() {
    return csvRows.map((row) => {
      const pressRunVal = mapping.pressRun ? parseInt(row[mapping.pressRun], 10) : undefined;
      const releaseDateVal = mapping.releaseDate ? row[mapping.releaseDate] : undefined;

      return {
        title: row[mapping.title!]?.trim() ?? "",
        artistName: row[mapping.artistName!]?.trim() ?? "",
        labelName: mapping.labelName ? row[mapping.labelName]?.trim() || undefined : undefined,
        releaseDate: releaseDateVal ? new Date(releaseDateVal) : undefined,
        orderUrl: mapping.orderUrl ? row[mapping.orderUrl]?.trim() || undefined : undefined,
        pressRun: pressRunVal && !isNaN(pressRunVal) ? pressRunVal : undefined,
        coloredVinyl: mapping.coloredVinyl ? parseBool(row[mapping.coloredVinyl]) : undefined,
        numbered: mapping.numbered ? parseBool(row[mapping.numbered]) : undefined,
        specialPackaging: mapping.specialPackaging
          ? row[mapping.specialPackaging]?.trim() || undefined
          : undefined,
      };
    }).filter((r) => r.title && r.artistName);
  }

  const previewReleases = step === "preview" ? buildReleases() : [];

  function handleImport() {
    const releases = buildReleases();
    if (releases.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    bulkMutation.mutate({ releases });
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
              <DialogTitle>Import Releases from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file with your upcoming releases. You&apos;ll map columns in the next step.
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
                Match your CSV columns to release fields. * indicates required fields.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {RELEASE_FIELDS.map((field) => (
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
                {previewReleases.length} valid releases will be imported.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Artist</th>
                    <th className="pb-2 pr-4 font-medium">Label</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {previewReleases.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-4">{r.title}</td>
                      <td className="py-1.5 pr-4">{r.artistName}</td>
                      <td className="py-1.5 pr-4">{r.labelName ?? "—"}</td>
                      <td className="py-1.5">
                        {r.releaseDate ? r.releaseDate.toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewReleases.length > 5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  ...and {previewReleases.length - 5} more
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
                disabled={bulkMutation.isPending || previewReleases.length === 0}
              >
                {bulkMutation.isPending
                  ? "Importing..."
                  : `Import ${previewReleases.length} Releases`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
