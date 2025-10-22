"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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

export function TopSpendingCategories({ spendingData, selectedMonth, onCategoryClick }) {
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [categoryTransactions, setCategoryTransactions] = useState({});
    const [loadingTransactions, setLoadingTransactions] = useState(new Set());
    const { toast } = useToast();

    // Fetch transactions for a specific category
    const fetchCategoryTransactions = async (category) => {
        if (categoryTransactions[category]) {
            return; // Already loaded
        }

        setLoadingTransactions((prev) => new Set(prev).add(category));

        try {
            const params = new URLSearchParams();
            if (selectedMonth) params.append("month", selectedMonth);
            if (category) params.append("category", category);
            params.append("transaction_type", "debit"); // Only show spending (debits)

            const response = await fetch(`http://127.0.0.1:8000/budget/transactions?${params}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch transactions");
            }

            const transactions = await response.json();
            setCategoryTransactions((prev) => ({
                ...prev,
                [category]: transactions,
            }));
        } catch (error) {
            console.error("Error fetching category transactions:", error);
            toast({
                title: "Error",
                description: "Failed to load transactions for this category",
                variant: "destructive",
            });
        } finally {
            setLoadingTransactions((prev) => {
                const newSet = new Set(prev);
                newSet.delete(category);
                return newSet;
            });
        }
    };

    // Toggle category expansion
    const toggleCategory = async (category) => {
        const newExpanded = new Set(expandedCategories);

        if (expandedCategories.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
            await fetchCategoryTransactions(category);
        }

        setExpandedCategories(newExpanded);
    };

    // Format currency
    const formatCurrency = (amount) => {
        return `$${Math.abs(amount).toFixed(2)}`;
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    if (!spendingData || !spendingData.categories || spendingData.categories.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Top Spending Categories
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">No spending data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top Spending Categories
                </CardTitle>
                <CardDescription>Click on a category to view individual transactions</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {spendingData.categories.slice(0, 5).map((category, index) => {
                        const isExpanded = expandedCategories.has(category.category);
                        const isLoading = loadingTransactions.has(category.category);
                        const transactions = categoryTransactions[category.category] || [];

                        return (
                            <div key={index} className="border rounded-lg">
                                {/* Category Header */}
                                <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer" onClick={() => toggleCategory(category.category)}>
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{
                                                backgroundColor: chartConfig[category.category]?.color || chartConfig["Uncategorized"].color,
                                            }}
                                        />
                                        <span className="font-medium">{category.category}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground">{category.transaction_count} transactions</span>
                                        <span className="font-medium">{formatCurrency(category.total_amount)}</span>
                                        <span className="text-sm text-muted-foreground">({category.percentage}%)</span>
                                    </div>
                                </div>

                                {/* Expanded Transactions Table */}
                                {isExpanded && (
                                    <div className="border-t bg-muted/20">
                                        {isLoading ? (
                                            <div className="p-4 text-center text-muted-foreground">Loading transactions...</div>
                                        ) : transactions.length > 0 ? (
                                            <div className="p-4">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Merchant</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {transactions.map((transaction) => (
                                                            <TableRow key={transaction._id}>
                                                                <TableCell className="text-sm">{formatDate(transaction.transaction_date)}</TableCell>
                                                                <TableCell className="font-medium">{transaction.merchant_payee}</TableCell>
                                                                <TableCell className="text-right font-medium text-red-600">{formatCurrency(transaction.amount)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-muted-foreground">No transactions found for this category</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
