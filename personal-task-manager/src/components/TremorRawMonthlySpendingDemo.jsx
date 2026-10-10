"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    formatDemoAxisCurrency,
    formatDemoCurrency,
    monthlySpendingDemoData,
    spendingDemoCategories,
} from "@/lib/spending-demo-data";

function TremorRawTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;

    return (
        <div className="min-w-44 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
            <p className="mb-2 border-b border-border pb-2 text-xs font-medium">{label}</p>
            <div className="space-y-1.5">
                {payload
                    .filter((item) => item.value !== undefined)
                    .map((item) => {
                        const category = spendingDemoCategories.find((entry) => entry.key === item.dataKey);
                        return (
                            <div key={item.dataKey} className="flex items-center justify-between gap-4 text-xs">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    {category?.label || item.name}
                                </span>
                                <span className="font-medium tabular-nums">{formatDemoCurrency(Number(item.value))}</span>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}

export function TremorRawMonthlySpendingDemo() {
    return (
        <div className="h-[340px] w-full" data-tremor-id="raw">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySpendingDemoData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickMargin={10}
                        minTickGap={8}
                    />
                    <YAxis
                        width={48}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickFormatter={formatDemoAxisCurrency}
                    />
                    <Tooltip content={<TremorRawTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
                    <Legend
                        verticalAlign="bottom"
                        height={38}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => {
                            const category = spendingDemoCategories.find((entry) => entry.key === value);
                            return <span className="text-xs text-muted-foreground">{category?.label || value}</span>;
                        }}
                    />
                    {spendingDemoCategories.map((category, index) => (
                        <Bar
                            key={category.key}
                            dataKey={category.key}
                            name={category.key}
                            stackId="spending"
                            fill={category.color}
                            radius={index === spendingDemoCategories.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]}
                            isAnimationActive={false}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
