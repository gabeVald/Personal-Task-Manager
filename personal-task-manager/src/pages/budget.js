"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, FileText, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import CsvImportDialog from "@/components/budget/CsvImportDialog";
import { BklitCategoryChart } from "@/components/financial-dashboard/BklitCategoryChart";
import { BklitDailySpendingHeatmap } from "@/components/financial-dashboard/BklitDailySpendingHeatmap";
import { BklitMonthlyTrendChart } from "@/components/financial-dashboard/BklitMonthlyTrendChart";
import { FinancialStatusCards } from "@/components/financial-dashboard/FinancialStatusCards";
import { getApiUrl } from "@/lib/api";

// Spending categories
const SPENDING_CATEGORIES = ["Food, Dining & Entertainment", "Auto, Commute & Travel", "Shopping", "Bills & Subscriptions", "Family & Pets", "Other Expenses", "Health & Personal Care"];
const TRANSACTIONS_PAGE_SIZE = 50;
function SortableTableHead({ label, sortKey, sort, onSort }) {
    const isActive = sort.key === sortKey;
    const direction = isActive ? sort.direction : null;
    const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;

    return (
        <TableHead aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
            <button
                type="button"
                className="inline-flex items-center gap-1 rounded-sm p-0 text-inherit hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Sort by ${label}${direction ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
                onClick={() => onSort(sortKey)}
            >
                {label}
                <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
        </TableHead>
    );
}

const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "color-mix(in srgb, var(--chart-1) 68%, var(--background))",
    "color-mix(in srgb, var(--chart-2) 68%, var(--background))",
    "var(--muted-foreground)",
];
const CHART_CATEGORIES = [...SPENDING_CATEGORIES, "Uncategorized"].map((key, index) => ({
    key,
    label: key,
    color: CHART_COLORS[index],
}));

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey, offset) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function BudgetPage() {
    const router = useRouter();
    const { toast } = useToast();

    // State management
    const [isLoading, setIsLoading] = useState(false);
    const [isCsvImporting, setIsCsvImporting] = useState(false);
    const [isDashboardLoading, setIsDashboardLoading] = useState(true);
    const [isTrendLoading, setIsTrendLoading] = useState(true);
    const [isTargetsSaving, setIsTargetsSaving] = useState(false);
    const [isCategoryRuleSaving, setIsCategoryRuleSaving] = useState(false);
    const [ofxFiles, setOfxFiles] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [categoryRules, setCategoryRules] = useState([]);
    const [categoryRulesExpanded, setCategoryRulesExpanded] = useState(false);
    const [transactionPage, setTransactionPage] = useState(0);
    const [transactionSort, setTransactionSort] = useState({ key: "date", direction: "desc" });
    const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
    const [spendingSummary, setSpendingSummary] = useState(null);
    const [multiMonthSummary, setMultiMonthSummary] = useState(null);
    const [budgetTargets, setBudgetTargets] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [csvImportOpen, setCsvImportOpen] = useState(false);
    const [categoryRuleDialogOpen, setCategoryRuleDialogOpen] = useState(false);
    const [categoryRuleForm, setCategoryRuleForm] = useState({ id: "", merchant_match: "", category: SPENDING_CATEGORIES[0] });
    const [activeTab, setActiveTab] = useState("overview");
    const [startMonth, setStartMonth] = useState(() => shiftMonthKey(getCurrentMonthKey(), -11));
    const [endMonth, setEndMonth] = useState(getCurrentMonthKey);

    // Check authentication
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/");
            return;
        }
    }, [router]);

    const authHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem("token")}`,
    });

    // Fetch imported statements and CSV files.
    const fetchOFXFiles = async () => {
        try {
            const response = await fetch(getApiUrl("/budget/files"), { headers: authHeaders() });
            if (!response.ok) throw new Error("Failed to fetch imported files");
            setOfxFiles(await response.json());
        } catch (error) {
            console.error("Error fetching imported files:", error);
            toast({ title: "Error", description: "Failed to load imported files", variant: "destructive" });
        }
    };

    const fetchTransactions = async (category = "", month = selectedMonth, page = transactionPage, sort = transactionSort) => {
        try {
            const params = new URLSearchParams();
            if (category) params.append("category", category);
            if (month) params.append("month", month);
            params.append("transaction_type", "debit");
            params.append("sort_by", sort.key);
            params.append("sort_order", sort.direction);
            params.append("skip", String(page * TRANSACTIONS_PAGE_SIZE));
            params.append("limit", String(TRANSACTIONS_PAGE_SIZE + 1));

            const response = await fetch(getApiUrl(`/budget/transactions?${params}`), { headers: authHeaders() });
            if (!response.ok) throw new Error("Failed to fetch transactions");
            const results = await response.json();
            setTransactions(results.slice(0, TRANSACTIONS_PAGE_SIZE));
            setHasMoreTransactions(results.length > TRANSACTIONS_PAGE_SIZE);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            toast({ title: "Error", description: "Failed to load transactions", variant: "destructive" });
        }
    };

    const sortTransactions = (key) => {
        const nextSort = {
            key,
            direction: transactionSort.key === key
                ? transactionSort.direction === "asc" ? "desc" : "asc"
                : key === "date" ? "desc" : "asc",
        };
        setTransactionSort(nextSort);
        setTransactionPage(0);
        fetchTransactions(selectedCategory, selectedMonth, 0, nextSort);
    };

    const fetchSpendingSummary = async (month = selectedMonth) => {
        setIsDashboardLoading(true);
        try {
            const params = new URLSearchParams({ month });
            const response = await fetch(getApiUrl(`/budget/summary?${params}`), { headers: authHeaders() });
            if (!response.ok) throw new Error("Failed to fetch spending summary");
            setSpendingSummary(await response.json());
        } catch (error) {
            console.error("Error fetching spending summary:", error);
            toast({ title: "Error", description: "Failed to load financial status", variant: "destructive" });
        } finally {
            setIsDashboardLoading(false);
        }
    };

    const fetchBudgetTargets = async (month = selectedMonth) => {
        try {
            const params = new URLSearchParams({ month });
            const response = await fetch(getApiUrl(`/budget/targets?${params}`), { headers: authHeaders() });
            if (!response.ok) throw new Error("Failed to fetch budget targets");
            const result = await response.json();
            setBudgetTargets(Array.isArray(result.targets) ? result.targets : []);
        } catch (error) {
            console.error("Error fetching budget targets:", error);
            toast({ title: "Error", description: "Failed to load budget targets", variant: "destructive" });
        }
    };

    const fetchCategoryRules = async () => {
        try {
            const response = await fetch(getApiUrl("/budget/category-rules"), { headers: authHeaders() });
            if (!response.ok) throw new Error("Failed to fetch category rules");
            setCategoryRules(await response.json());
        } catch (error) {
            console.error("Error fetching category rules:", error);
            toast({ title: "Error", description: "Failed to load automatic category rules", variant: "destructive" });
        }
    };

    const openCategoryRuleDialog = ({ rule, transaction } = {}) => {
        setCategoryRuleForm({
            id: rule?.id || "",
            merchant_match: rule?.merchant_match || transaction?.merchant_payee || "",
            category: rule?.category || (transaction?.category && transaction.category !== "Uncategorized" ? transaction.category : SPENDING_CATEGORIES[0]),
        });
        setCategoryRuleDialogOpen(true);
    };

    const saveCategoryRule = async (event) => {
        event.preventDefault();
        setIsCategoryRuleSaving(true);
        try {
            const isEditing = Boolean(categoryRuleForm.id);
            const endpoint = isEditing
                ? getApiUrl(`/budget/category-rules/${categoryRuleForm.id}`)
                : getApiUrl("/budget/category-rules");
            const response = await fetch(endpoint, {
                method: isEditing ? "PUT" : "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    merchant_match: categoryRuleForm.merchant_match.trim(),
                    category: categoryRuleForm.category,
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "Failed to save category rule");
            await fetchCategoryRules();
            setCategoryRuleDialogOpen(false);
            toast({
                title: isEditing ? "Default updated" : "Default saved",
                description: `Future transactions matching “${result.merchant_match}” will use ${result.category}.`,
            });
        } catch (error) {
            toast({ title: "Could not save default", description: error.message, variant: "destructive" });
        } finally {
            setIsCategoryRuleSaving(false);
        }
    };

    const deleteCategoryRule = async (rule) => {
        try {
            const response = await fetch(getApiUrl(`/budget/category-rules/${rule.id}`), {
                method: "DELETE",
                headers: authHeaders(),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "Failed to delete category rule");
            setCategoryRules((currentRules) => currentRules.filter((currentRule) => currentRule.id !== rule.id));
            toast({ title: "Default removed", description: `New “${rule.merchant_match}” transactions will use their imported category.` });
        } catch (error) {
            toast({ title: "Could not remove default", description: error.message, variant: "destructive" });
        }
    };

    const fetchMultiMonthSummary = async (start = startMonth, end = endMonth) => {
        if (!start || !end || start > end) return;
        setIsTrendLoading(true);
        try {
            const params = new URLSearchParams({ start_month: start, end_month: end });
            const response = await fetch(getApiUrl(`/budget/summary/multi-month?${params}`), { headers: authHeaders() });
            if (!response.ok) throw new Error("Failed to fetch trend summary");
            setMultiMonthSummary(await response.json());
        } catch (error) {
            console.error("Error fetching multi-month summary:", error);
            toast({ title: "Error", description: "Failed to load monthly spending trends", variant: "destructive" });
        } finally {
            setIsTrendLoading(false);
        }
    };

    const refreshBudgetData = async (month = selectedMonth) => {
        await Promise.all([
            fetchOFXFiles(),
            fetchSpendingSummary(month),
            fetchBudgetTargets(month),
            fetchTransactions(selectedCategory, month),
            fetchMultiMonthSummary(startMonth, endMonth),
        ]);
    };

    const saveBudgetTargets = async (targets) => {
        setIsTargetsSaving(true);
        try {
            const response = await fetch(getApiUrl("/budget/targets"), {
                method: "PUT",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ month: selectedMonth, targets }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Failed to save budget targets");
            }

            const result = await response.json();
            setBudgetTargets(result.targets || []);
            toast({ title: "Targets saved", description: "Your monthly budget targets have been updated." });
        } catch (error) {
            toast({ title: "Could not save targets", description: error.message, variant: "destructive" });
            throw error;
        } finally {
            setIsTargetsSaving(false);
        }
    };

    // Handle file upload
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".ofx") && !file.name.toLowerCase().endsWith(".qfx")) {
            toast({
                title: "Invalid file type",
                description: "Please upload an OFX or QFX file",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(getApiUrl("/budget/upload"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to upload file");
            }

            const result = await response.json();
            toast({
                title: "Success",
                description: `File uploaded successfully. ${result.transaction_count} transactions parsed.`,
            });

            await refreshBudgetData(selectedMonth);

            setUploadDialogOpen(false);
        } catch (error) {
            console.error("Error uploading file:", error);
            toast({
                title: "Upload failed",
                description: error.message || "Failed to upload file",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCsvImport = async (file) => {
        setIsCsvImporting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(getApiUrl("/budget/upload"), {
                method: "POST",
                headers: authHeaders(),
                body: formData,
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.detail || "Failed to import CSV");
            }

            await refreshBudgetData(selectedMonth);
            toast({
                title: "CSV imported",
                description: `${result.transaction_count || 0} transactions added${result.duplicate_count ? `; ${result.duplicate_count} duplicates skipped` : ""}.`,
            });
            return result;
        } finally {
            setIsCsvImporting(false);
        }
    };

    // Update transaction category
    const updateTransactionCategory = async (transactionId, newCategory) => {
        try {
            const response = await fetch(getApiUrl(`/budget/transactions/${transactionId}/category`), {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ category: newCategory }),
            });

            if (!response.ok) {
                throw new Error("Failed to update category");
            }

            toast({
                title: "Success",
                description: "Transaction category updated",
            });

            await Promise.all([
                fetchSpendingSummary(selectedMonth),
                fetchTransactions(selectedCategory, selectedMonth),
                fetchMultiMonthSummary(startMonth, endMonth),
            ]);
        } catch (error) {
            console.error("Error updating category:", error);
            toast({
                title: "Error",
                description: "Failed to update category",
                variant: "destructive",
            });
        }
    };

    // Delete OFX file
    const deleteOFXFile = async (fileId) => {
        if (!confirm("Are you sure you want to delete this file and all its transactions?")) {
            return;
        }

        try {
            const response = await fetch(getApiUrl(`/budget/files/${fileId}`), {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to delete file");
            }

            toast({
                title: "Success",
                description: "File and transactions deleted",
            });

            await refreshBudgetData(selectedMonth);
        } catch (error) {
            console.error("Error deleting file:", error);
            toast({
                title: "Error",
                description: "Failed to delete file",
                variant: "destructive",
            });
        }
    };

    // Load current-period status, budget targets, transaction details, and the default 12-month trend.
    useEffect(() => {
        fetchOFXFiles();
        fetchCategoryRules();
        fetchSpendingSummary(selectedMonth);
        fetchBudgetTargets(selectedMonth);
        fetchTransactions("", selectedMonth);
        fetchMultiMonthSummary(startMonth, endMonth);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fetch functions are invoked once on mount; filters and mutations refresh explicitly.

    // Generate month options (last 12 months)
    const generateMonthOptions = () => {
        const months = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
            const monthLabel = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
            months.push({ value: monthStr, label: monthLabel });
        }
        return months;
    };

    const monthOptions = generateMonthOptions();

    const selectDashboardMonth = (month) => {
        setSelectedMonth(month);
        setSelectedCategory("");
        setTransactionPage(0);
        fetchSpendingSummary(month);
        fetchBudgetTargets(month);
        fetchTransactions("", month, 0);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Financial overview</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight">Budget & Spending</h1>
                    <p className="mt-1 text-muted-foreground">Understand cash flow, spending trends, and category budgets.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV
                    </Button>
                    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload OFX/QFX
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload OFX or QFX file</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="file">Select OFX/QFX file</Label>
                                    <Input id="file" type="file" accept=".ofx,.qfx" onChange={handleFileUpload} disabled={isLoading} />
                                </div>
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>Import a bank statement. Transactions will be added to your dashboard and can be categorized later.</AlertDescription>
                                </Alert>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <CsvImportDialog
                isImporting={isCsvImporting}
                onImport={handleCsvImport}
                onOpenChange={setCsvImportOpen}
                open={csvImportOpen}
            />

            <Dialog open={categoryRuleDialogOpen} onOpenChange={setCategoryRuleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{categoryRuleForm.id ? "Edit automatic category" : "Set an automatic category"}</DialogTitle>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={saveCategoryRule}>
                        <p className="text-sm text-muted-foreground">
                            Matching is case-insensitive and looks for this text anywhere in the merchant name. The rule applies to future imports, takes priority over the bank’s category, and the longest matching rule wins.
                        </p>
                        <div className="grid gap-2">
                            <Label htmlFor="category-rule-merchant">Merchant text to match</Label>
                            <Input
                                id="category-rule-merchant"
                                maxLength={200}
                                onChange={(event) => setCategoryRuleForm((form) => ({ ...form, merchant_match: event.target.value }))}
                                placeholder="e.g. Amark"
                                required
                                value={categoryRuleForm.merchant_match}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category-rule-category">Default category</Label>
                            <Select
                                value={categoryRuleForm.category}
                                onValueChange={(category) => setCategoryRuleForm((form) => ({ ...form, category }))}
                            >
                                <SelectTrigger id="category-rule-category">
                                    <SelectValue placeholder="Choose a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SPENDING_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                                    <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCategoryRuleDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isCategoryRuleSaving || !categoryRuleForm.merchant_match.trim()}>
                                {isCategoryRuleSaving ? "Saving…" : "Save default"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Dashboard period">
                        <div>
                            <h2 className="font-semibold">Monthly status</h2>
                            <p className="text-sm text-muted-foreground">Choose a month to inspect cash flow and budget progress.</p>
                            {Number(spendingSummary?.pending_count) > 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {spendingSummary.pending_count} pending transaction{spendingSummary.pending_count === 1 ? "" : "s"} excluded from settled totals.
                                </p>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="dashboard-month" className="shrink-0">Month</Label>
                            <Select
                                value={selectedMonth}
                                onValueChange={selectDashboardMonth}
                            >
                                <SelectTrigger id="dashboard-month" className="w-48">
                                    <SelectValue placeholder="Select month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthOptions.map((month) => (
                                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </section>

                    <FinancialStatusCards
                        isLoading={isDashboardLoading}
                        periodLabel={monthOptions.find((month) => month.value === selectedMonth)?.label || selectedMonth}
                        summary={spendingSummary}
                        targets={budgetTargets}
                        targetCategories={[...SPENDING_CATEGORIES, "Uncategorized"]}
                        targetEditorTitle={`${monthOptions.find((month) => month.value === selectedMonth)?.label || selectedMonth} budget targets`}
                        isTargetsSaving={isTargetsSaving}
                        onSaveTargets={saveBudgetTargets}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>Choose a trend range</CardTitle>
                            <CardDescription>Compare monthly spending composition using settled transactions and their posting dates.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="grid flex-1 gap-2">
                                <Label htmlFor="trend-start">From</Label>
                                <Select value={startMonth} onValueChange={setStartMonth}>
                                    <SelectTrigger id="trend-start"><SelectValue placeholder="Start month" /></SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid flex-1 gap-2">
                                <Label htmlFor="trend-end">Through</Label>
                                <Select value={endMonth} onValueChange={setEndMonth}>
                                    <SelectTrigger id="trend-end"><SelectValue placeholder="End month" /></SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                className="sm:min-w-36"
                                onClick={() => {
                                    if (startMonth > endMonth) {
                                        toast({ title: "Invalid range", description: "The start month must be before the end month.", variant: "destructive" });
                                        return;
                                    }
                                    fetchMultiMonthSummary(startMonth, endMonth);
                                }}
                                type="button"
                            >
                                Update trend
                            </Button>
                        </CardContent>
                    </Card>

                    <BklitMonthlyTrendChart
                        categories={CHART_CATEGORIES}
                        data={Object.entries(multiMonthSummary?.monthly_totals || {})
                            .sort(([left], [right]) => left.localeCompare(right))
                            .map(([month, totals]) => ({
                                month,
                                label: formatMonthLabel(month),
                                total_spent: Number(totals.amount) || 0,
                                categories: multiMonthSummary?.monthly_categories?.[month] || {},
                            }))}
                        description={`${formatMonthLabel(startMonth)} – ${formatMonthLabel(endMonth)} · stacked by spending category`}
                        isLoading={isTrendLoading}
                        onMonthClick={selectDashboardMonth}
                    />

                    <div className="grid gap-6 xl:grid-cols-2">
                        <BklitCategoryChart
                            categoryColors={CHART_CATEGORIES}
                            categories={spendingSummary?.categories || []}
                            isLoading={isDashboardLoading}
                            targets={budgetTargets}
                            onCategoryClick={(category) => {
                                setSelectedCategory(category);
                                setTransactionPage(0);
                                fetchTransactions(category, selectedMonth, 0);
                                setActiveTab("transactions");
                            }}
                        />
                        <BklitDailySpendingHeatmap
                            categories={[
                                ...SPENDING_CATEGORIES,
                                "Uncategorized",
                                ...(spendingSummary?.categories || []).map(({ category }) => category),
                            ]}
                            dailyTotalsByCategory={spendingSummary?.daily_totals_by_category}
                            isLoading={isDashboardLoading}
                            month={selectedMonth}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                            <button
                                type="button"
                                className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-expanded={categoryRulesExpanded}
                                aria-controls="automatic-category-defaults"
                                onClick={() => setCategoryRulesExpanded((expanded) => !expanded)}
                            >
                                <ChevronDown
                                    className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${categoryRulesExpanded ? "" : "-rotate-90"}`}
                                    aria-hidden="true"
                                />
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2 font-semibold leading-none">
                                        Automatic category defaults
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground" aria-label={`${categoryRules.length} defaults`}>
                                            {categoryRules.length}
                                        </span>
                                    </span>
                                    <span className="mt-2 block text-sm text-muted-foreground">Rules categorize future imports when the merchant name contains the matching text.</span>
                                </span>
                            </button>
                            <Button variant="outline" onClick={() => openCategoryRuleDialog()}>
                                Add default
                            </Button>
                        </CardHeader>
                        <CardContent id="automatic-category-defaults" hidden={!categoryRulesExpanded} className="space-y-2">
                            {categoryRules.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No defaults yet. Use “Set default” on a transaction or add one here.</p>
                            ) : (
                                <div className="space-y-2">
                                    {categoryRules.map((rule) => (
                                        <div key={rule.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="min-w-0 flex-1 text-sm">
                                                <span className="font-medium">{rule.merchant_match}</span>
                                                <span className="mx-2 text-muted-foreground">→</span>
                                                <span>{rule.category}</span>
                                            </p>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openCategoryRuleDialog({ rule })}>Edit</Button>
                                                <Button variant="outline" size="sm" onClick={() => deleteCategoryRule(rule)}>Delete</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-4">
                        <Select
                            value={selectedCategory || "all"}
                            onValueChange={(value) => {
                                const category = value === "all" ? "" : value;
                                setSelectedCategory(category);
                                setTransactionPage(0);
                                fetchTransactions(category, selectedMonth, 0);
                            }}
                        >
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {SPENDING_CATEGORIES.map((category) => (
                                    <SelectItem key={category} value={category}>
                                        {category}
                                    </SelectItem>
                                ))}
                                <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Transactions</CardTitle>
                            <CardDescription>
                                {transactions.length > 0
                                    ? `Showing ${transactionPage * TRANSACTIONS_PAGE_SIZE + 1}–${transactionPage * TRANSACTIONS_PAGE_SIZE + transactions.length} transactions for ${monthOptions.find((month) => month.value === selectedMonth)?.label || selectedMonth}`
                                    : `No transactions for ${monthOptions.find((month) => month.value === selectedMonth)?.label || selectedMonth}`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableTableHead
                                            label="Date"
                                            sortKey="date"
                                            sort={transactionSort}
                                            onSort={sortTransactions}
                                        />
                                        <SortableTableHead
                                            label="Merchant"
                                            sortKey="merchant"
                                            sort={transactionSort}
                                            onSort={sortTransactions}
                                        />
                                        <SortableTableHead
                                            label="Amount"
                                            sortKey="amount"
                                            sort={transactionSort}
                                            onSort={sortTransactions}
                                        />
                                        <TableHead>Category</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell className="py-10 text-center text-muted-foreground" colSpan={5}>
                                                No spending transactions for this month and category.
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                    {transactions.map((transaction) => (
                                        <TableRow key={transaction._id}>
                                            <TableCell>{new Date(transaction.transaction_date).toLocaleDateString()}</TableCell>
                                            <TableCell>{transaction.merchant_payee}</TableCell>
                                            <TableCell className="text-red-600">${Math.abs(transaction.amount).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Select value={transaction.category} onValueChange={(value) => updateTransactionCategory(transaction._id, value)}>
                                                    <SelectTrigger className="w-48">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SPENDING_CATEGORIES.map((category) => (
                                                            <SelectItem key={category} value={category}>
                                                                {category}
                                                            </SelectItem>
                                                        ))}
                                                        <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => updateTransactionCategory(transaction._id, "Uncategorized")}>
                                                    Reset
                                                </Button>
                                                <Button className="ml-2" variant="outline" size="sm" onClick={() => openCategoryRuleDialog({ transaction })}>
                                                    Set default
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex items-center justify-between gap-3">
                                <Button
                                    variant="outline"
                                    disabled={transactionPage === 0}
                                    onClick={() => {
                                        const page = transactionPage - 1;
                                        setTransactionPage(page);
                                        fetchTransactions(selectedCategory, selectedMonth, page);
                                    }}
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">Page {transactionPage + 1}</span>
                                <Button
                                    variant="outline"
                                    disabled={!hasMoreTransactions}
                                    onClick={() => {
                                        const page = transactionPage + 1;
                                        setTransactionPage(page);
                                        fetchTransactions(selectedCategory, selectedMonth, page);
                                    }}
                                >
                                    Next
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="files" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Imported statement files
                            </CardTitle>
                            <CardDescription>Manage OFX, QFX, and CSV imports and their transactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Filename</TableHead>
                                        <TableHead>Upload Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Transactions</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ofxFiles.map((file) => (
                                        <TableRow key={file._id}>
                                            <TableCell>{file.original_filename}</TableCell>
                                            <TableCell>{new Date(file.upload_date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <span
                                                    className={`px-2 py-1 rounded text-xs ${
                                                        file.parsed_status === "success" ? "bg-green-100 text-green-800" : file.parsed_status === "error" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                                                    }`}
                                                >
                                                    {file.parsed_status}
                                                </span>
                                            </TableCell>
                                            <TableCell>{file.transaction_count}</TableCell>
                                            <TableCell>
                                                <Button variant="destructive" size="sm" onClick={() => deleteOFXFile(file._id)}>
                                                    Delete
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
