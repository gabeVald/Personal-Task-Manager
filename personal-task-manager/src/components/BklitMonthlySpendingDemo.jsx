"use client";

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { TooltipContent } from "@/components/charts/tooltip/tooltip-content";
import {
    formatDemoCurrency,
    monthlySpendingDemoData,
    spendingDemoCategories,
} from "@/lib/spending-demo-data";

function BklitTooltip({ point }) {
    return (
        <TooltipContent
            title={point.month}
            rows={spendingDemoCategories.map((category) => ({
                label: category.label,
                value: formatDemoCurrency(point[category.key]),
                color: category.color,
            }))}
        />
    );
}

export function BklitMonthlySpendingDemo() {
    return (
        <div
            className="[--chart-background:var(--background)] [--chart-foreground:var(--foreground)] [--chart-foreground-muted:var(--muted-foreground)] [--chart-grid:var(--border)] [--chart-line-primary:var(--chart-1)] [--chart-line-secondary:var(--chart-2)] [--chart-crosshair:var(--primary)]"
        >
            <BarChart
                data={monthlySpendingDemoData}
                xDataKey="month"
                stacked
                barGap={0.34}
                className="h-[340px] w-full"
                aspectRatio="2.75 / 1"
                margin={{ top: 28, right: 12, bottom: 42, left: 12 }}
            >
                <Grid horizontal fadeHorizontal={false} strokeDasharray="3,4" />
                {spendingDemoCategories.map((category) => (
                    <Bar key={category.key} dataKey={category.key} fill={category.color} animate />
                ))}
                <BarXAxis showAllLabels maxLabels={12} />
                <ChartTooltip
                    content={({ point }) => <BklitTooltip point={point} />}
                    showCrosshair
                    showDots={false}
                    showDatePill
                />
            </BarChart>
        </div>
    );
}
