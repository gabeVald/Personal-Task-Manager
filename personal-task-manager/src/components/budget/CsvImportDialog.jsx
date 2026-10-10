import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    FileSpreadsheet,
    FileUp,
    Loader2,
    RefreshCw,
    X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const MAX_INVALID_ROWS_TO_DISPLAY = 5;

function getErrorMessage(error) {
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error && typeof error.message === "string" && error.message.trim()) {
        return error.message;
    }

    if (error && typeof error.detail === "string" && error.detail.trim()) {
        return error.detail;
    }

    return "We couldn't import this CSV. Check the file and try again.";
}

function formatCount(value) {
    const count = Number(value);

    return Number.isFinite(count) && count >= 0
        ? new Intl.NumberFormat().format(count)
        : "0";
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "CSV file";
    }

    if (bytes < 1024) {
        return `${bytes} bytes`;
    }

    const kilobytes = bytes / 1024;
    return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}

function getRowError(error) {
    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (error && typeof error.message === "string" && error.message.trim()) {
        return error.message;
    }

    return "This row could not be imported.";
}

export default function CsvImportDialog({
    open,
    onOpenChange,
    onImport,
    isImporting,
}) {
    const [file, setFile] = useState(null);
    const [selectionError, setSelectionError] = useState("");
    const [importError, setImportError] = useState("");
    const [result, setResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const requestIdRef = useRef(0);
    const requestInFlightRef = useRef(false);
    const wasOpenRef = useRef(open);
    const isBusy = Boolean(isImporting || isSubmitting);

    const resetForm = useCallback(() => {
        requestIdRef.current += 1;
        requestInFlightRef.current = false;
        setFile(null);
        setSelectionError("");
        setImportError("");
        setResult(null);
        setIsSubmitting(false);
    }, []);

    useEffect(() => {
        if (wasOpenRef.current && !open && !isBusy) {
            resetForm();
        }

        wasOpenRef.current = open;
    }, [open, isBusy, resetForm]);

    const handleFileSelection = (selectedFile) => {
        setImportError("");
        setResult(null);

        if (!selectedFile) {
            setFile(null);
            setSelectionError("");
            return;
        }

        if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
            setFile(null);
            setSelectionError("Choose a file with the .csv extension to continue.");
            return;
        }

        setFile(selectedFile);
        setSelectionError("");
    };

    const handleFileChange = (event) => {
        const selectedFile = event.currentTarget.files?.[0] ?? null;
        event.currentTarget.value = "";
        handleFileSelection(selectedFile);
    };

    const handleRemoveFile = () => {
        if (isBusy) {
            return;
        }

        handleFileSelection(null);
    };

    const handleImport = async () => {
        if (!file || isBusy || requestInFlightRef.current) {
            return;
        }

        requestInFlightRef.current = true;
        const requestId = ++requestIdRef.current;
        setImportError("");
        setIsSubmitting(true);

        try {
            if (typeof onImport !== "function") {
                throw new Error("CSV import is unavailable. Please try again later.");
            }

            const importResult = await onImport(file);

            if (requestId === requestIdRef.current) {
                setResult(importResult ?? {});
            }
        } catch (error) {
            if (requestId === requestIdRef.current) {
                setImportError(getErrorMessage(error));
            }
        } finally {
            if (requestId === requestIdRef.current) {
                requestInFlightRef.current = false;
                setIsSubmitting(false);
            }
        }
    };

    const handleImportAnother = () => {
        if (!isBusy) {
            resetForm();
        }
    };

    const invalidRows = Array.isArray(result?.invalid_rows)
        ? result.invalid_rows
        : [];
    const displayedInvalidRows = invalidRows.slice(
        0,
        MAX_INVALID_ROWS_TO_DISPLAY
    );
    const omittedInvalidRows = Math.max(
        0,
        invalidRows.length - displayedInvalidRows.length
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-6 sm:max-w-xl">
                <DialogHeader className="gap-3 pr-7 text-left">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FileSpreadsheet aria-hidden="true" className="size-5" />
                    </div>
                    <div className="space-y-1.5">
                        <DialogTitle className="text-xl">
                            Import transactions from CSV
                        </DialogTitle>
                        <DialogDescription>
                            Choose a bank-export CSV to add transactions to your budget.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label
                            htmlFor="csv-import-file"
                            className="relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/60 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
                        >
                            <span className="flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                                <FileUp aria-hidden="true" className="size-5" />
                            </span>
                            <span className="space-y-1">
                                <span className="block text-sm font-medium">
                                    Choose a CSV file
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    Select a .csv file from your device
                                </span>
                            </span>
                            <input
                                id="csv-import-file"
                                type="file"
                                accept=".csv,text/csv"
                                className="sr-only"
                                aria-describedby="csv-import-fields"
                                disabled={isBusy}
                                onChange={handleFileChange}
                            />
                        </label>

                        {file && (
                            <div
                                className="flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                                aria-live="polite"
                            >
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                    <FileSpreadsheet
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium" title={file.name}>
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatFileSize(file.size)}
                                    </p>
                                </div>
                                {!isBusy && !result && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0"
                                        aria-label={`Remove ${file.name}`}
                                        onClick={handleRemoveFile}
                                    >
                                        <X aria-hidden="true" className="size-4" />
                                    </Button>
                                )}
                            </div>
                        )}

                        {selectionError && (
                            <Alert variant="destructive" className="py-2.5">
                                <AlertCircle aria-hidden="true" />
                                <AlertDescription>{selectionError}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <div
                        id="csv-import-fields"
                        className="rounded-lg border bg-muted/30 px-4 py-3"
                    >
                        <p className="text-sm font-medium">Recognized fields</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            We&apos;ll look for Posting Date, Amount, Transaction ID,
                            and category columns in your file.
                        </p>
                    </div>

                    {isBusy && (
                        <div
                            className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
                            role="status"
                            aria-live="polite"
                        >
                            <Loader2
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
                            />
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">
                                    Importing your CSV...
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    We&apos;re validating the file and adding its transactions.
                                </p>
                            </div>
                        </div>
                    )}

                    {importError && !isBusy && (
                        <Alert variant="destructive">
                            <AlertCircle aria-hidden="true" />
                            <AlertDescription>{importError}</AlertDescription>
                        </Alert>
                    )}

                    {result && !isBusy && (
                        <section
                            className="space-y-4 rounded-xl border bg-background p-4"
                            aria-labelledby="csv-import-result-title"
                            aria-live="polite"
                        >
                            <div className="flex items-start gap-3">
                                <CheckCircle2
                                    aria-hidden="true"
                                    className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                />
                                <div className="min-w-0 space-y-1">
                                    <h3
                                        id="csv-import-result-title"
                                        className="font-medium"
                                    >
                                        Import finished
                                    </h3>
                                    {result.status != null && result.status !== "" && (
                                        <p className="text-sm text-muted-foreground">
                                            Status: {String(result.status)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <dl className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                                    <dt className="text-xs text-muted-foreground">
                                        Transactions inserted
                                    </dt>
                                    <dd className="mt-1 text-lg font-semibold tabular-nums">
                                        {formatCount(result.transaction_count)}
                                    </dd>
                                </div>
                                <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                                    <dt className="text-xs text-muted-foreground">
                                        Duplicates skipped
                                    </dt>
                                    <dd className="mt-1 text-lg font-semibold tabular-nums">
                                        {formatCount(result.duplicate_count)}
                                    </dd>
                                </div>
                            </dl>

                            {invalidRows.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <h4 className="text-sm font-medium">
                                            Rows needing attention ({formatCount(invalidRows.length)})
                                        </h4>
                                        {omittedInvalidRows > 0 && (
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {formatCount(omittedInvalidRows)} more not shown
                                            </span>
                                        )}
                                    </div>
                                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                                        {displayedInvalidRows.map((row, index) => (
                                            <li
                                                key={`${row?.row ?? "row"}-${index}`}
                                                className="flex items-start gap-2 text-sm"
                                            >
                                                <AlertCircle
                                                    aria-hidden="true"
                                                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                                                />
                                                <span className="min-w-0">
                                                    <span className="font-medium">
                                                        Row {row?.row ?? index + 1}:
                                                    </span>{" "}
                                                    <span className="text-muted-foreground">
                                                        {getRowError(row?.error)}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    {result && !isBusy ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleImportAnother}
                            >
                                Import another CSV
                            </Button>
                            <Button
                                type="button"
                                onClick={() => onOpenChange(false)}
                            >
                                Done
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Close
                            </Button>
                            <Button
                                type="button"
                                onClick={handleImport}
                                disabled={!file || isBusy || Boolean(selectionError)}
                            >
                                {isBusy ? (
                                    <Loader2
                                        aria-hidden="true"
                                        className="mr-2 size-4 animate-spin"
                                    />
                                ) : importError ? (
                                    <RefreshCw
                                        aria-hidden="true"
                                        className="mr-2 size-4"
                                    />
                                ) : (
                                    <FileUp
                                        aria-hidden="true"
                                        className="mr-2 size-4"
                                    />
                                )}
                                {isBusy
                                    ? "Importing..."
                                    : importError
                                      ? "Try import again"
                                      : "Import CSV"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
