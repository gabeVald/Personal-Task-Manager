"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, CreditCard, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BudgetTargetsEditor } from "./BudgetTargetsEditor";
import { formatCurrency, toFiniteNumber } from "./formatters";

function StatusCard({ title, icon: Icon, action, children, description, className = "" }) {
    return (
        <Card className={`min-w-0 ${className}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {action || <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                {children}
                {description ? <p className="mt-2 text-xs text-muted-foreground">{description}</p> : null}
            </CardContent>
        </Card>
    );
}

function OverallTargetCard({
    targetAmount,
    spent,
    progress,
    remaining,
    overBy,
    isOverTarget,
    targets,
    categories,
    isSaving,
    onSave,
    title,
}) {
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    return (
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <StatusCard
                action={(
                    <DialogTrigger asChild>
                        <Button aria-label="Edit monthly budget targets" size="icon" title="Edit monthly budget targets" type="button" variant="ghost">
                            <Target aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DialogTrigger>
                )}
                title="Overall target"
            >
                {targetAmount !== null ? (
                    <>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <p className="text-2xl font-semibold tabular-nums">
                                {targetAmount === 0 ? "—" : `${Math.round(progress)}%`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formatCurrency(spent)} of {formatCurrency(targetAmount)}
                            </p>
                        </div>
                        {targetAmount > 0 ? (
                            <div
                                aria-label={`Overall target progress: ${Math.round(progress)} percent`}
                                aria-valuemax={100}
                                aria-valuemin={0}
                                aria-valuenow={Math.round(progress)}
                                className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                            >
                                <div
                                    className={`h-full rounded-full transition-[width] ${isOverTarget ? "bg-destructive" : "bg-primary"}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        ) : null}
                        <p className={`mt-2 text-xs ${isOverTarget ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                            {targetAmount === 0
                                ? spent > 0
                                    ? `${formatCurrency(spent)} spent against a $0.00 target`
                                    : "A $0.00 target is set for this period"
                                : isOverTarget
                                    ? `${formatCurrency(overBy)} over target`
                                    : `${formatCurrency(remaining)} remaining`}
                        </p>
                    </>
                ) : (
                    <div className="pt-1">
                        <p className="font-medium">No overall target set</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Add a monthly Overall target to track progress and remaining budget.
                        </p>
                    </div>
                )}
            </StatusCard>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Set monthly spending limits for your overall budget and individual categories.</DialogDescription>
                </DialogHeader>
                <BudgetTargetsEditor
                    categories={categories}
                    embedded
                    isSaving={isSaving}
                    onCancel={() => setIsEditorOpen(false)}
                    onSave={typeof onSave === "function" ? async (nextTargets) => {
                        await onSave(nextTargets);
                        setIsEditorOpen(false);
                    } : undefined}
                    startEditing
                    targets={targets}
                />
            </DialogContent>
        </Dialog>
    );
}

function LoadingCard({ title }) {
    return (
        <Card aria-label={`${title} loading`} aria-busy="true" className="min-w-0">
            <CardHeader className="pb-2">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
                <div className="h-7 w-32 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-3 w-40 animate-pulse rounded bg-muted" />
            </CardContent>
        </Card>
    );
}

function getOverallTarget(targets) {
    if (!Array.isArray(targets)) {
        return null;
    }

    return targets.find(
        (target) =>
            typeof target?.category === "string" &&
            target.category.trim().toLowerCase() === "overall" &&
            Number.isFinite(Number(target.amount)) &&
            Number(target.amount) >= 0
    ) ?? null;
}

export function FinancialStatusCards({
    summary,
    targets = [],
    periodLabel = "This month",
    isLoading = false,
    targetCategories = [],
    isTargetsSaving = false,
    onSaveTargets,
    targetEditorTitle = "Monthly budget targets",
}) {
    if (isLoading) {
        return (
            <section aria-busy="true" aria-label="Financial status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status">
                <span className="sr-only">Loading financial status…</span>
                {[
                    "Spending",
                    "Money in",
                    "Net cash flow",
                    "Overall target",
                ].map((title) => <LoadingCard key={title} title={title} />)}
            </section>
        );
    }

    const spent = toFiniteNumber(summary?.total_spent);
    const income = toFiniteNumber(summary?.total_income);
    const netCashFlow = Number.isFinite(Number(summary?.net_cash_flow))
        ? Number(summary.net_cash_flow)
        : income - spent;
    const overallTarget = getOverallTarget(targets);
    const targetAmount = overallTarget ? Number(overallTarget.amount) : null;
    const hasActivity = spent !== 0 || income !== 0 || netCashFlow !== 0;
    const progress = targetAmount > 0 ? Math.min(100, (spent / targetAmount) * 100) : 0;
    const remaining = targetAmount === null ? null : Math.max(0, targetAmount - spent);
    const overBy = targetAmount === null ? null : Math.max(0, spent - targetAmount);
    const isOverTarget = overBy > 0;

    return (
        <section aria-label={`${periodLabel} financial status`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard
                description={hasActivity ? `Total spending ${periodLabel.toLowerCase()}` : `No spending recorded ${periodLabel.toLowerCase()}`}
                icon={CreditCard}
                title="Spending"
            >
                <p className="text-2xl font-semibold tabular-nums">{formatCurrency(spent)}</p>
            </StatusCard>

            <StatusCard
                description={hasActivity ? `Income received ${periodLabel.toLowerCase()}` : `No income recorded ${periodLabel.toLowerCase()}`}
                icon={CircleDollarSign}
                title="Money in"
            >
                <p className="text-2xl font-semibold tabular-nums">{formatCurrency(income)}</p>
            </StatusCard>

            <StatusCard
                description={`Income minus spending ${periodLabel.toLowerCase()}`}
                icon={netCashFlow < 0 ? ArrowDownRight : ArrowUpRight}
                title="Net cash flow"
            >
                <p className={`text-2xl font-semibold tabular-nums ${netCashFlow < 0 ? "text-destructive" : "text-foreground"}`}>
                    {formatCurrency(netCashFlow)}
                </p>
            </StatusCard>

            <OverallTargetCard
                categories={targetCategories}
                isOverTarget={isOverTarget}
                isSaving={isTargetsSaving}
                onSave={onSaveTargets}
                overBy={overBy}
                progress={progress}
                remaining={remaining}
                spent={spent}
                targetAmount={targetAmount}
                targets={targets}
                title={targetEditorTitle}
            />
        </section>
    );
}
