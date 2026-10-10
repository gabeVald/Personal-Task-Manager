"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { TooltipContent } from "@/components/charts/tooltip/tooltip-content";
import { formatCurrency, toFiniteNumber } from "./formatters";

const CHART_TOKENS = "[--chart-background:var(--background)] [--chart-foreground:var(--foreground)] [--chart-foreground-muted:var(--muted-foreground)] [--chart-grid:var(--border)] [--chart-line-primary:var(--chart-1)] [--chart-line-secondary:var(--chart-2)] [--chart-crosshair:var(--primary)]";
const FALLBACK_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

function normalizeSeries(categories, rows) {
    const providedSeries = Array.isArray(categories)
        ? categories.filter((category) => typeof category?.key === "string" && category.key.trim())
        : [];

    if (providedSeries.length > 0) {
        return providedSeries.map((category, index) => ({
            key: category.key,
            label: category.label || category.key,
            color: category.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        }));
    }

    const discoveredKeys = [...new Set(
        rows.flatMap((row) => row?.categories && typeof row.categories === "object"
            ? Object.keys(row.categories)
            : [])
    )];

    if (discoveredKeys.length > 0) {
        return discoveredKeys.map((key, index) => ({
            key,
            label: key,
            color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        }));
    }

    return [{ key: "__total_spent", label: "Total spending", color: FALLBACK_COLORS[0], useTotal: true }];
}

function BklitTrendTooltip({ point, series }) {
    const rows = series.map((category) => ({
        label: category.label,
        value: formatCurrency(point[category.key]),
        color: category.color,
    }));

    rows.push({
        label: "Total spending",
        value: formatCurrency(point.total_spent),
        color: "var(--chart-foreground-muted)",
    });

    return <TooltipContent title={point.label} rows={rows} />;
}

export function BklitMonthlyTrendChart({
    data = [],
    categories = [],
    isLoading = false,
    title = "Monthly spending trend",
    description = "Spending by category over time",
}) {
    const rows = Array.isArray(data) ? data : [];
    const series = normalizeSeries(categories, rows);
    const chartData = rows.map((row) => {
        const point = {
            ...row,
            label: row?.label || row?.month || "Unknown month",
            total_spent: toFiniteNumber(row?.total_spent),
        };

        series.forEach((category) => {
            const sourceValue = category.useTotal
                ? point.total_spent
                : row?.categories?.[category.key] ?? row?.categories?.[category.label];
            point[category.key] = toFiniteNumber(sourceValue);
        });

        return point;
    });

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {rows.length === 0 && !isLoading ? (
                    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed px-6 text-center">
                        <div>
                            <p className="font-medium">No monthly spending data yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Your category trend will appear when transactions are available.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className={CHART_TOKENS}>
                        <BarChart
                            aspectRatio="2.8 / 1"
                            barGap={0.34}
                            className="h-[280px] w-full sm:h-[320px]"
                            data={chartData}
                            margin={{ top: 28, right: 12, bottom: 42, left: 12 }}
                            status={isLoading ? "loading" : "ready"}
                            stacked
                            xDataKey="label"
                        >
                            <Grid horizontal fadeHorizontal={false} strokeDasharray="3,4" />
                            {series.map((category) => (
                                <Bar
                                    animate
                                    dataKey={category.key}
                                    fill={category.color}
                                    key={category.key}
                                />
                            ))}
                            <BarXAxis maxLabels={12} showAllLabels={chartData.length <= 6} />
                            <ChartTooltip
                                content={({ point }) => <BklitTrendTooltip point={point} series={series} />}
                                showCrosshair
                                showDatePill
                                showDots={false}
                            />
                        </BarChart>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
