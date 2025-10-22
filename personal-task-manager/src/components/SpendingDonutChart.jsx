"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Chart configuration for spending categories
const chartConfig = {
    amount: {
        label: "Amount",
    },
    "Food, Dining & Entertainment": {
        label: "Food & Dining",
        color: "hsl(var(--chart-1))",
    },
    "Auto, Commute & Travel": {
        label: "Auto & Travel",
        color: "hsl(var(--chart-2))",
    },
    "Shopping": {
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
    "Uncategorized": {
        label: "Uncategorized",
        color: "hsl(var(--muted))",
    },
};

export function SpendingDonutChart({ spendingData, onCategoryClick }) {
    // Transform spending data for the chart
    const chartData = React.useMemo(() => {
        if (!spendingData || !spendingData.categories) return [];
        
        return spendingData.categories.map((category) => ({
            category: category.category,
            amount: category.total_amount,
            fill: chartConfig[category.category]?.color || chartConfig["Uncategorized"].color,
        }));
    }, [spendingData]);

    const totalSpent = React.useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.amount, 0);
    }, [chartData]);

    const handlePieClick = (data) => {
        if (onCategoryClick && data) {
            onCategoryClick(data.category);
        }
    };

    if (!chartData || chartData.length === 0) {
        return (
            <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                    <CardTitle>Spending Breakdown</CardTitle>
                    <CardDescription>No spending data available</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Upload OFX files to see your spending breakdown</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>Spending Breakdown</CardTitle>
                <CardDescription>
                    {spendingData?.month || "Current Month"}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[300px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="amount"
                            nameKey="category"
                            innerRadius={60}
                            outerRadius={120}
                            strokeWidth={2}
                            onClick={handlePieClick}
                            className="cursor-pointer"
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-2xl font-bold"
                                                >
                                                    ${totalSpent.toLocaleString()}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 20}
                                                    className="fill-muted-foreground text-sm"
                                                >
                                                    Total Spent
                                                </tspan>
                                            </text>
                                        );
                                    }
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {chartData.slice(0, 6).map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                            onClick={() => handlePieClick(item)}
                        >
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.fill }}
                            />
                            <span className="truncate">{chartConfig[item.category]?.label || item.category}</span>
                            <span className="ml-auto font-medium">
                                ${item.amount.toFixed(0)}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
