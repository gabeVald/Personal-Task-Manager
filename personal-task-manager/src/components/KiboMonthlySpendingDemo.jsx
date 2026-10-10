"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import {
    formatDemoAxisCurrency,
    formatDemoCurrency,
    monthlySpendingDemoData,
    spendingDemoCategories,
} from "@/lib/spending-demo-data";

const chartConfig = Object.fromEntries(
    spendingDemoCategories.map((category) => [category.key, { label: category.label, color: category.color }])
);

export function KiboMonthlySpendingDemo() {
    return (
        <ChartContainer config={chartConfig} className="h-[340px] w-full">
            <BarChart data={monthlySpendingDemoData} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
                <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={formatDemoAxisCurrency} />
                <ChartTooltip
                    cursor={false}
                    content={
                        <ChartTooltipContent
                            labelFormatter={(label) => label}
                            formatter={(value) => formatDemoCurrency(Number(value))}
                        />
                    }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {spendingDemoCategories.map((category, index) => (
                    <Bar
                        key={category.key}
                        dataKey={category.key}
                        name={category.label}
                        stackId="spending"
                        fill={`var(--color-${category.key})`}
                        radius={index === spendingDemoCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                ))}
            </BarChart>
        </ChartContainer>
    );
}
