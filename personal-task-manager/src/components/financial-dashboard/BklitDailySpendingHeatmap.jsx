"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, toFiniteNumber } from "./formatters";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const INTENSITY_CLASSES = ["bg-muted", "bg-primary/10", "bg-primary/25", "bg-primary/40", "bg-primary text-primary-foreground"];

function makeMonthCells(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const cells = Array.from({ length: cellCount }, (_, index) => {
        const day = index - firstWeekday + 1;
        return day >= 1 && day <= daysInMonth ? day : null;
    });

    return {
        year,
        month,
        daysInMonth,
        cells,
        label: new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
}

function getDayKey(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getIntensity(value, maximum) {
    return value > 0 && maximum > 0 ? Math.min(4, Math.ceil((value / maximum) * 4)) : 0;
}

function getCategoryMetric(categoryTotals, selectedCategories, metric) {
    return Object.entries(categoryTotals || {}).reduce((total, [category, values]) => {
        if (selectedCategories.length > 0 && !selectedCategories.includes(category)) return total;
        return total + Math.max(0, toFiniteNumber(values?.[metric === "amount" ? "amount" : "count"]));
    }, 0);
}

function dayDescription(date, metric, value) {
    const label = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    if (metric === "amount") return `${label}: ${formatCurrency(value)} spent`;
    return `${label}: ${value.toLocaleString("en-US")} settled debit ${value === 1 ? "transaction" : "transactions"}`;
}

export function BklitDailySpendingHeatmap({
    categories = [],
    dailyTotalsByCategory,
    isLoading = false,
    month,
}) {
    const [metric, setMetric] = useState("amount");
    const [selectedCategories, setSelectedCategories] = useState([]);
    const monthCalendar = makeMonthCells(month);
    const categoryOptions = [...new Set([
        ...categories,
        ...Object.values(dailyTotalsByCategory || {}).flatMap((day) => Object.keys(day)),
        ...selectedCategories,
    ].filter((category) => typeof category === "string" && category.trim()))];
    const dailyValues = Array.from({ length: monthCalendar.daysInMonth }, (_, index) => {
        const day = index + 1;
        const dayKey = getDayKey(monthCalendar.year, monthCalendar.month, day);
        const totals = dailyTotalsByCategory?.[dayKey];
        return getCategoryMetric(totals, selectedCategories, metric);
    });
    const maximum = Math.max(0, ...dailyValues);
    const selectedCategoryLabel = selectedCategories.length === 0
        ? "All categories"
        : selectedCategories.length === 1
            ? selectedCategories[0]
            : `${selectedCategories.length} categories`;

    return (
        <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <CalendarDays aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                        <CardTitle>Daily spending</CardTitle>
                        <CardDescription className="mt-1">{monthCalendar.label} · Settled debit activity by posting date.</CardDescription>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={metric} onValueChange={setMetric}>
                        <SelectTrigger aria-label="Heatmap metric" className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="amount">Amount spent</SelectItem>
                            <SelectItem value="count">Transaction count</SelectItem>
                        </SelectContent>
                    </Select>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                aria-label={`Filter heatmap categories: ${selectedCategoryLabel}`}
                                className="max-w-56 justify-between gap-2"
                                variant="outline"
                            >
                                <span className="truncate">{selectedCategoryLabel}</span>
                                <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-80 w-72">
                            <DropdownMenuLabel>Categories</DropdownMenuLabel>
                            <DropdownMenuCheckboxItem
                                checked={selectedCategories.length === 0}
                                onCheckedChange={(checked) => {
                                    if (checked) setSelectedCategories([]);
                                }}
                                onSelect={(event) => event.preventDefault()}
                            >
                                All categories
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            {categoryOptions.map((category) => (
                                <DropdownMenuCheckboxItem
                                    checked={selectedCategories.includes(category)}
                                    key={category}
                                    onCheckedChange={(checked) => setSelectedCategories((selected) => (
                                        checked
                                            ? [...selected, category]
                                            : selected.filter((item) => item !== category)
                                    ))}
                                    onSelect={(event) => event.preventDefault()}
                                >
                                    {category}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div aria-busy="true" aria-label="Daily spending heatmap loading" className="h-56 animate-pulse rounded-lg bg-muted" role="status" />
                ) : !dailyTotalsByCategory ? (
                    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
                        Daily spending data is unavailable.
                    </div>
                ) : (
                    <table aria-label={`Daily ${metric === "amount" ? "spending" : "transaction count"} for ${monthCalendar.label}`} className="w-full table-fixed border-separate border-spacing-1 text-center">
                        <thead>
                            <tr>
                                {WEEKDAYS.map((weekday) => (
                                    <th className="pb-1 text-xs font-medium text-muted-foreground" key={weekday} scope="col">
                                        <span aria-hidden="true">{weekday.slice(0, 3)}</span>
                                        <span className="sr-only">{weekday}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: monthCalendar.cells.length / 7 }, (_, weekIndex) => (
                                <tr key={weekIndex}>
                                    {monthCalendar.cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
                                        if (!day) return <td aria-hidden="true" className="h-14 p-0" key={`${weekIndex}-${dayIndex}`} />;

                                        const dayKey = getDayKey(monthCalendar.year, monthCalendar.month, day);
                                        const value = dailyValues[day - 1];
                                        const date = new Date(monthCalendar.year, monthCalendar.month - 1, day);
                                        const description = dayDescription(date, metric, value);
                                        const intensity = getIntensity(value, maximum);

                                        return (
                                            <td className="h-14 p-0" key={dayKey}>
                                                <div
                                                    aria-label={description}
                                                    className={`group relative flex h-14 cursor-default flex-col items-center justify-center rounded-md text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${INTENSITY_CLASSES[intensity]}`}
                                                    role="img"
                                                    tabIndex={0}
                                                >
                                                    <span>{day}</span>
                                                    <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-normal text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                                                        {description}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Color intensity is relative to the highest day for this month, metric, and category selection.</span>
                    <div aria-label="Heatmap intensity from no activity to highest" className="flex items-center gap-1.5">
                        <span>No activity</span>
                        {INTENSITY_CLASSES.map((className, index) => (
                            <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${className}`} key={index} />
                        ))}
                        <span>Highest</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
