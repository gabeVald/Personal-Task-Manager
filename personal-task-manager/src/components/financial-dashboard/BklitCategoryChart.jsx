"use client";

import { ArrowRight, ChartColumnIncreasing } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { TooltipContent } from "@/components/charts/tooltip/tooltip-content";
import { Button } from "@/components/ui/button";
import { formatCurrency, toFiniteNumber } from "./formatters";

const CHART_TOKENS = "[--chart-background:var(--background)] [--chart-foreground:var(--foreground)] [--chart-foreground-muted:var(--muted-foreground)] [--chart-grid:var(--border)] [--chart-line-primary:var(--chart-1)] [--chart-line-secondary:var(--chart-2)] [--chart-crosshair:var(--primary)]";
const CHART_CATEGORY_LIMIT = 5;

function shortenLabel(label, maxLength = 10) {
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function CategoryTooltip({ point }) {
    const rows = [
        { label: "Spending", value: formatCurrency(point.total_amount), color: point.chartColor || "var(--chart-1)" },
        {
            label: "Transactions",
            value: `${Math.max(0, Math.round(toFiniteNumber(point.transaction_count))).toLocaleString("en-US")}`,
            color: "var(--chart-2)",
        },
    ];

    if (Number.isFinite(Number(point.percentage))) {
        rows.push({
            label: "Share of spending",
            value: `${Math.max(0, Number(point.percentage)).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
            color: "var(--chart-3)",
        });
    }

    return <TooltipContent title={point.category} rows={rows} />;
}

function LoadingContent() {
    return (
        <div aria-label="Category spending loading" aria-busy="true" className="space-y-4" role="status">
            <div className="h-60 animate-pulse rounded-lg bg-muted" />
            <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                    <div className="h-10 animate-pulse rounded-md bg-muted" key={row} />
                ))}
            </div>
        </div>
    );
}

export function BklitCategoryChart({
    categories = [],
    categoryColors = [],
    targets = [],
    onCategoryClick,
    isLoading = false,
    title = "Spending by category",
    description = "Highest-spending categories this period",
}) {
    const colorByCategory = new Map(
        (Array.isArray(categoryColors) ? categoryColors : [])
            .filter((category) => typeof category?.key === "string" && typeof category?.color === "string")
            .map((category) => [category.key.trim().toLowerCase(), category.color])
    );
    const targetByCategory = new Map(
        (Array.isArray(targets) ? targets : [])
            .filter((target) => typeof target?.category === "string" && target.category.trim().toLowerCase() !== "overall")
            .map((target) => [target.category.trim().toLowerCase(), Number(target.amount)])
            .filter(([, amount]) => Number.isFinite(amount) && amount >= 0)
    );
    const rankedCategories = (Array.isArray(categories) ? categories : [])
        .filter((category) => typeof category?.category === "string" && category.category.trim())
        .map((category) => ({
            ...category,
            category: category.category.trim(),
            total_amount: Math.max(0, toFiniteNumber(category.total_amount)),
            transaction_count: Math.max(0, toFiniteNumber(category.transaction_count)),
            budget_target: targetByCategory.get(category.category.trim().toLowerCase()),
        }))
        .sort((left, right) => right.total_amount - left.total_amount);
    const chartData = rankedCategories.slice(0, CHART_CATEGORY_LIMIT).map((category, index) => ({
        ...category,
        label: `${index + 1} · ${shortenLabel(category.category, 5)}`,
        chartColor: colorByCategory.get(category.category.toLowerCase()) || "var(--chart-1)",
    }));

    return (
        <Card className="min-w-0">
            <CardHeader>
                <div className="flex items-start gap-3">
                    <ChartColumnIncreasing aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                        <CardTitle>{title}</CardTitle>
                        <CardDescription className="mt-1">{description}. Select a category below to view its details.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {isLoading ? (
                    <LoadingContent />
                ) : rankedCategories.length === 0 ? (
                    <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed px-6 text-center">
                        <div>
                            <p className="font-medium">No category spending to show</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Spending categories will appear here after transactions are recorded.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={CHART_TOKENS}>
                            <BarChart
                                aspectRatio="2.6 / 1"
                                barGap={0.32}
                                className="h-[250px] w-full sm:h-[280px]"
                                data={chartData}
                                margin={{ top: 20, right: 12, bottom: 42, left: 12 }}
                                xDataKey="label"
                            >
                                <Grid horizontal fadeHorizontal={false} strokeDasharray="3,4" />
                                <Bar animate dataKey="total_amount" fillDataKey="chartColor" />
                                <BarXAxis maxLabels={CHART_CATEGORY_LIMIT} showAllLabels />
                                <ChartTooltip
                                    content={({ point }) => <CategoryTooltip point={point} />}
                                    showCrosshair
                                    showDatePill={false}
                                    showDots={false}
                                />
                            </BarChart>
                        </div>

                        <section aria-label="Ranked category spending" className="space-y-1">
                            <h3 className="mb-2 text-sm font-medium">Category details</h3>
                            <ol className="space-y-1">
                                {rankedCategories.map((category, index) => (
                                    <li key={category.category} className="rounded-lg border">
                                        <Button
                                            aria-label={`View ${category.category} details, ${formatCurrency(category.total_amount)} spent`}
                                            className="h-auto w-full justify-between gap-3 px-3 py-2.5 text-left"
                                            disabled={!onCategoryClick}
                                            onClick={() => onCategoryClick?.(category.category)}
                                            type="button"
                                            variant="ghost"
                                        >
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                                    {index + 1}
                                                </span>
                                                <span
                                                    aria-hidden="true"
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: colorByCategory.get(category.category.toLowerCase()) || "var(--chart-1)" }}
                                                />
                                                <span className="min-w-0 truncate font-medium">{category.category}</span>
                                            </span>
                                            <span className="flex shrink-0 items-center gap-2">
                                                <span className="text-right">
                                                    <span className="block text-sm font-medium tabular-nums">{formatCurrency(category.total_amount)}</span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {Math.round(category.transaction_count).toLocaleString("en-US")} {Math.round(category.transaction_count) === 1 ? "transaction" : "transactions"}
                                                    </span>
                                                </span>
                                                <ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                                            </span>
                                        </Button>
                                        {Number.isFinite(category.budget_target) ? (
                                            <div className="space-y-1.5 px-4 pb-3 pl-12">
                                                <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                                                    <span>Target {formatCurrency(category.budget_target)}</span>
                                                    <span className={category.total_amount > category.budget_target ? "font-medium text-destructive" : ""}>
                                                        {category.total_amount > category.budget_target
                                                            ? `${formatCurrency(category.total_amount - category.budget_target)} over`
                                                            : `${formatCurrency(category.budget_target - category.total_amount)} left`}
                                                    </span>
                                                </div>
                                                <div
                                                    aria-label={`${category.category} target progress`}
                                                    aria-valuemax={100}
                                                    aria-valuemin={0}
                                                    aria-valuenow={category.budget_target > 0 ? Math.min(100, Math.round((category.total_amount / category.budget_target) * 100)) : 0}
                                                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                                                    role="progressbar"
                                                >
                                                    <div
                                                        className={`h-full rounded-full ${category.total_amount > category.budget_target ? "bg-destructive" : "bg-primary"}`}
                                                        style={{ width: `${category.budget_target > 0 ? Math.min(100, (category.total_amount / category.budget_target) * 100) : category.total_amount > 0 ? 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
