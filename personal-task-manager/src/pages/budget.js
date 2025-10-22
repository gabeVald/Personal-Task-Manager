"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileText, DollarSign, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SpendingDonutChart } from "@/components/SpendingDonutChart";
import { TopSpendingCategories } from "@/components/TopSpendingCategories";

// Spending categories
const SPENDING_CATEGORIES = ["Food, Dining & Entertainment", "Auto, Commute & Travel", "Shopping", "Bills & Subscriptions", "Family & Pets", "Other Expenses", "Health & Personal Care"];

// Chart configuration for spending categories
const chartConfig = {
    "Food, Dining & Entertainment": {
        label: "Food & Dining",
        color: "hsl(var(--chart-1))",
    },
    "Auto, Commute & Travel": {
        label: "Auto & Travel",
        color: "hsl(var(--chart-2))",
    },
    Shopping: {
        label: "Shopping",
        color: "hsl(var(--chart-3))",
    },
    "Bills & Subscriptions": {
        label: "Bills",
        color: "hsl(var(--chart-4))",
    },
    "Family & Pets": {
        label: "Family & Pets",
        color: "hsl(var(--chart-5))",
    },
    "Other Expenses": {
        label: "Other",
        color: "hsl(var(--chart-6))",
    },
    "Health & Personal Care": {
        label: "Health & Care",
        color: "hsl(var(--chart-7))",
    },
    Uncategorized: {
        label: "Uncategorized",
        color: "hsl(var(--muted))",
    },
};

export default function BudgetPage() {
    const router = useRouter();
    const { toast } = useToast();

    // State management
    const [isLoading, setIsLoading] = useState(false);
    const [ofxFiles, setOfxFiles] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [spendingSummary, setSpendingSummary] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [monthlyIncome, setMonthlyIncome] = useState("");
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState("single"); // "single" or "multi"
    const [startMonth, setStartMonth] = useState("");
    const [endMonth, setEndMonth] = useState("");

    // Check authentication
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/");
            return;
        }
    }, [router]);

    // Fetch OFX files
    const fetchOFXFiles = async () => {
        try {
            const response = await fetch("http://127.0.0.1:8000/budget/files", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch OFX files");
            }

            const files = await response.json();
            setOfxFiles(files);
        } catch (error) {
            console.error("Error fetching OFX files:", error);
            toast({
                title: "Error",
                description: "Failed to load OFX files",
                variant: "destructive",
            });
        }
    };

    // Fetch transactions
    const fetchTransactions = async (category = "", month = "") => {
        try {
            let url = "http://127.0.0.1:8000/budget/transactions?";
            const params = new URLSearchParams();

            if (category) params.append("category", category);
            if (month) params.append("month", month);
            params.append("transaction_type", "debit"); // Only show spending (debits)

            url += params.toString();

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch transactions");
            }

            const data = await response.json();
            setTransactions(data);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            toast({
                title: "Error",
                description: "Failed to load transactions",
                variant: "destructive",
            });
        }
    };

    // Fetch spending summary
    const fetchSpendingSummary = async (month = "") => {
        try {
            let url = "http://127.0.0.1:8000/budget/summary";
            if (month) url += `?month=${month}`;

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch spending summary");
            }

            const summary = await response.json();
            setSpendingSummary(summary);
        } catch (error) {
            console.error("Error fetching spending summary:", error);
            toast({
                title: "Error",
                description: "Failed to load spending summary",
                variant: "destructive",
            });
        }
    };

    // Fetch multi-month spending summary
    const fetchMultiMonthSummary = async (startMonth, endMonth) => {
        try {
            const params = new URLSearchParams();
            params.append("start_month", startMonth);
            params.append("end_month", endMonth);

            const response = await fetch(`http://127.0.0.1:8000/budget/summary/multi-month?${params}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch multi-month summary");
            }

            const data = await response.json();
            setSpendingSummary(data);
        } catch (error) {
            console.error("Error fetching multi-month summary:", error);
            toast({
                title: "Error",
                description: "Failed to load multi-month summary",
                variant: "destructive",
            });
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

            const response = await fetch("http://127.0.0.1:8000/budget/upload", {
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

            // Refresh data
            await fetchOFXFiles();
            await fetchSpendingSummary(selectedMonth);
            await fetchTransactions(selectedCategory, selectedMonth);

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

    // Update transaction category
    const updateTransactionCategory = async (transactionId, newCategory) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/budget/transactions/${transactionId}/category`, {
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

            // Refresh data
            await fetchSpendingSummary(selectedMonth);
            await fetchTransactions(selectedCategory, selectedMonth);
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
            const response = await fetch(`http://127.0.0.1:8000/budget/files/${fileId}`, {
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

            // Refresh data
            await fetchOFXFiles();
            await fetchSpendingSummary(selectedMonth);
            await fetchTransactions(selectedCategory, selectedMonth);
        } catch (error) {
            console.error("Error deleting file:", error);
            toast({
                title: "Error",
                description: "Failed to delete file",
                variant: "destructive",
            });
        }
    };

    // Load data on component mount
    useEffect(() => {
        fetchOFXFiles();
        fetchSpendingSummary();
        fetchTransactions();
    }, []);

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

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Budget & Expenses</h1>
                    <p className="text-muted-foreground">Track your spending with OFX file uploads</p>
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload OFX File
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload OFX File</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="file">Select OFX/QFX File</Label>
                                <Input id="file" type="file" accept=".ofx,.qfx" onChange={handleFileUpload} disabled={isLoading} />
                            </div>
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>Upload your bank's OFX or QFX file to automatically parse transactions.</AlertDescription>
                            </Alert>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Monthly Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="viewMode">View:</Label>
                                    <Select
                                        value={viewMode}
                                        onValueChange={(value) => {
                                            setViewMode(value);
                                            if (value === "single") {
                                                fetchSpendingSummary(selectedMonth);
                                            } else {
                                                if (startMonth && endMonth) {
                                                    fetchMultiMonthSummary(startMonth, endMonth);
                                                }
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-32">
                                            <SelectValue placeholder="View mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Single Month</SelectItem>
                                            <SelectItem value="multi">Multi Month</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {viewMode === "single" ? (
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="month">Month:</Label>
                                        <Select
                                            value={selectedMonth}
                                            onValueChange={(value) => {
                                                setSelectedMonth(value);
                                                fetchSpendingSummary(value);
                                                fetchTransactions(selectedCategory, value);
                                            }}
                                        >
                                            <SelectTrigger className="w-48">
                                                <SelectValue placeholder="Select month" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {monthOptions.map((month) => (
                                                    <SelectItem key={month.value} value={month.value}>
                                                        {month.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="startMonth">Start Month:</Label>
                                            <Select
                                                value={startMonth}
                                                onValueChange={(value) => {
                                                    setStartMonth(value);
                                                    if (endMonth) {
                                                        fetchMultiMonthSummary(value, endMonth);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-48">
                                                    <SelectValue placeholder="Start month" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {monthOptions.map((month) => (
                                                        <SelectItem key={month.value} value={month.value}>
                                                            {month.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="endMonth">End Month:</Label>
                                            <Select
                                                value={endMonth}
                                                onValueChange={(value) => {
                                                    setEndMonth(value);
                                                    if (startMonth) {
                                                        fetchMultiMonthSummary(startMonth, value);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-48">
                                                    <SelectValue placeholder="End month" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {monthOptions.map((month) => (
                                                        <SelectItem key={month.value} value={month.value}>
                                                            {month.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {spendingSummary && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="font-medium">Total Spent:</span>
                                            <span className="text-red-600">${spendingSummary.total_spent.toFixed(2)}</span>
                                        </div>
                                        {viewMode === "multi" && spendingSummary.monthly_totals && (
                                            <div className="space-y-1">
                                                <span className="font-medium text-sm">Monthly Breakdown:</span>
                                                {Object.entries(spendingSummary.monthly_totals)
                                                    .sort(([a], [b]) => b.localeCompare(a))
                                                    .map(([month, data]) => (
                                                        <div key={month} className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">{new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                                                            <span className="text-red-600">${data.amount.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="font-medium">{viewMode === "multi" ? "Total Income:" : "Monthly Income:"}</span>
                                            <Input type="number" placeholder="Enter income" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className="w-32" />
                                        </div>
                                        {monthlyIncome && (
                                            <div className="flex justify-between">
                                                <span className="font-medium">Remaining:</span>
                                                <span className={parseFloat(monthlyIncome) - spendingSummary.total_spent >= 0 ? "text-green-600" : "text-red-600"}>
                                                    ${(parseFloat(monthlyIncome) - spendingSummary.total_spent).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <SpendingDonutChart
                            spendingData={spendingSummary}
                            onCategoryClick={(category) => {
                                setSelectedCategory(category);
                                fetchTransactions(category, selectedMonth);
                                // Switch to transactions tab
                                const transactionsTab = document.querySelector('[value="transactions"]');
                                if (transactionsTab) transactionsTab.click();
                            }}
                        />
                    </div>

                    <TopSpendingCategories
                        spendingData={spendingSummary}
                        selectedMonth={selectedMonth}
                        onCategoryClick={(category) => {
                            setSelectedCategory(category);
                            fetchTransactions(category, selectedMonth);
                            const transactionsTab = document.querySelector('[value="transactions"]');
                            if (transactionsTab) transactionsTab.click();
                        }}
                    />
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Select
                            value={selectedCategory}
                            onValueChange={(value) => {
                                setSelectedCategory(value);
                                fetchTransactions(value, selectedMonth);
                            }}
                        >
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Categories</SelectItem>
                                {SPENDING_CATEGORIES.map((category) => (
                                    <SelectItem key={category} value={category}>
                                        {category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Transactions</CardTitle>
                            <CardDescription>{transactions.length} transactions found</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Merchant</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
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
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => updateTransactionCategory(transaction._id, "Uncategorized")}>
                                                    Reset
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="files" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Uploaded OFX Files
                            </CardTitle>
                            <CardDescription>Manage your uploaded OFX files</CardDescription>
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
