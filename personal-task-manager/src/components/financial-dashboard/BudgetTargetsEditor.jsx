"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "./formatters";

const EMPTY_ARRAY = [];

function isOverallCategory(category) {
    return typeof category === "string" && category.trim().toLowerCase() === "overall";
}

function getCategoryName(category) {
    if (typeof category === "string") {
        return category.trim();
    }

    if (category && typeof category === "object") {
        return String(category.category || category.label || category.key || "").trim();
    }

    return "";
}

function buildDrafts(targets) {
    const drafts = {};

    (Array.isArray(targets) ? targets : []).forEach((target) => {
        const category = getCategoryName(target?.category);
        const amount = Number(target?.amount);

        if (category && Number.isFinite(amount) && amount >= 0) {
            drafts[isOverallCategory(category) ? "Overall" : category] = String(amount);
        }
    });

    return drafts;
}

function normalizeAmount(value) {
    return Number.isFinite(value * 100) ? Math.round(value * 100) / 100 : value;
}

function TargetAmountField({ id, label, value, error, onChange, isDisabled, description, className = "" }) {
    const errorId = `${id}-error`;

    return (
        <div className={`grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-center ${className}`}>
            <div className="space-y-1">
                <Label htmlFor={id}>{label}</Label>
                {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                {error ? <p className="text-xs text-destructive" id={errorId}>{error}</p> : null}
            </div>
            <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={Boolean(error)}
                    className="pl-7 tabular-nums"
                    disabled={isDisabled}
                    id={id}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={value}
                />
            </div>
        </div>
    );
}

export function BudgetTargetsEditor({
    targets = EMPTY_ARRAY,
    categories = EMPTY_ARRAY,
    onSave,
    isSaving = false,
    title = "Monthly budget targets",
}) {
    const idPrefix = useId();
    const [drafts, setDrafts] = useState(() => buildDrafts(targets));
    const [isEditing, setIsEditing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setDrafts(buildDrafts(targets));
        }
    }, [targets, isEditing]);

    const knownCategories = useMemo(() => {
        const names = [
            ...(Array.isArray(categories) ? categories.map(getCategoryName) : []),
            ...Object.keys(drafts),
        ];

        return [...new Set(names.filter((name) => name && !isOverallCategory(name)))];
    }, [categories, drafts]);
    const availableCategories = knownCategories.filter((category) => !Object.hasOwn(drafts, category));
    const categoryTargetNames = Object.keys(drafts)
        .filter((category) => !isOverallCategory(category))
        .sort((left, right) => left.localeCompare(right));
    const overallValue = drafts.Overall ?? "";
    const isBusy = isSaving || isSubmitting;

    function beginEditing() {
        setDrafts(buildDrafts(targets));
        setErrors({});
        setSaveError("");
        setIsEditing(true);
    }

    function cancelEditing() {
        setDrafts(buildDrafts(targets));
        setErrors({});
        setSaveError("");
        setSelectedCategory("");
        setIsEditing(false);
    }

    function updateAmount(category, value) {
        setDrafts((current) => ({ ...current, [category]: value }));
        setErrors((current) => ({ ...current, [category]: "" }));
        setSaveError("");
    }

    function addCategoryTarget() {
        if (!selectedCategory) {
            return;
        }

        setDrafts((current) => ({ ...current, [selectedCategory]: "" }));
        setSelectedCategory("");
    }

    function removeCategoryTarget(category) {
        setDrafts((current) => {
            const next = { ...current };
            delete next[category];
            return next;
        });
        setErrors((current) => {
            const next = { ...current };
            delete next[category];
            return next;
        });
    }

    async function handleSave(event) {
        event.preventDefault();
        const nextErrors = {};
        const parsedAmounts = {};

        Object.entries(drafts).forEach(([category, rawAmount]) => {
            const trimmedAmount = String(rawAmount).trim();
            if (!trimmedAmount) {
                return;
            }

            const amount = Number(trimmedAmount);
            if (!Number.isFinite(amount) || amount < 0) {
                nextErrors[category] = "Enter a valid amount of $0.00 or more, or leave it blank to remove this target.";
                return;
            }

            parsedAmounts[category] = normalizeAmount(amount);
        });

        setErrors(nextErrors);
        setSaveError("");

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        const nextTargets = [];
        if (Object.hasOwn(parsedAmounts, "Overall")) {
            nextTargets.push({ category: "Overall", amount: parsedAmounts.Overall });
        }
        Object.keys(parsedAmounts)
            .filter((category) => category !== "Overall")
            .sort((left, right) => left.localeCompare(right))
            .forEach((category) => nextTargets.push({ category, amount: parsedAmounts[category] }));

        if (typeof onSave !== "function") {
            setSaveError("Saving is unavailable right now.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(nextTargets);
            setDrafts(buildDrafts(nextTargets));
            setIsEditing(false);
            setSelectedCategory("");
        } catch {
            setSaveError("Targets could not be saved. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card className="min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription className="mt-2">
                        Set monthly spending limits for your overall budget and individual categories.
                    </CardDescription>
                </div>
                {!isEditing ? (
                    <Button aria-label="Edit monthly budget targets" className="shrink-0" onClick={beginEditing} type="button" variant="outline">
                        <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                        Edit
                    </Button>
                ) : null}
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <form className="space-y-6" noValidate onSubmit={handleSave}>
                        <div className="space-y-5">
                            <TargetAmountField
                                description="The spending limit for the whole month. Leave blank for no Overall target."
                                error={errors.Overall}
                                id={`${idPrefix}-overall`}
                                isDisabled={isBusy}
                                label="Overall monthly target"
                                onChange={(value) => updateAmount("Overall", value)}
                                value={overallValue}
                            />

                            {categoryTargetNames.map((category) => (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end" key={category}>
                                    <TargetAmountField
                                        className="flex-1"
                                        description="Leave blank to remove this category target."
                                        error={errors[category]}
                                        id={`${idPrefix}-${encodeURIComponent(category)}`}
                                        isDisabled={isBusy}
                                        label={`${category} target`}
                                        onChange={(value) => updateAmount(category, value)}
                                        value={drafts[category]}
                                    />
                                    <Button
                                        aria-label={`Remove ${category} target`}
                                        className="justify-self-end sm:justify-self-auto"
                                        disabled={isBusy}
                                        onClick={() => removeCategoryTarget(category)}
                                        size="icon"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Label htmlFor={`${idPrefix}-add-category`}>Add a category target</Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={availableCategories.length === 0 || isBusy}
                                    id={`${idPrefix}-add-category`}
                                    onChange={(event) => setSelectedCategory(event.target.value)}
                                    value={selectedCategory}
                                >
                                    <option value="">
                                        {availableCategories.length > 0 ? "Choose a category" : "All available categories have targets"}
                                    </option>
                                    {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                                </select>
                            </div>
                            <Button disabled={!selectedCategory || isBusy} onClick={addCategoryTarget} type="button" variant="outline">
                                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                                Add category
                            </Button>
                        </div>

                        {saveError ? <p className="text-sm text-destructive" role="alert">{saveError}</p> : null}

                        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                            <Button disabled={isBusy} onClick={cancelEditing} type="button" variant="outline">Cancel</Button>
                            <Button disabled={isBusy || typeof onSave !== "function"} type="submit">
                                {isBusy ? "Saving…" : "Save targets"}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-3">
                        {Object.keys(drafts).length === 0 ? (
                            <p className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
                                No monthly targets set. Add an Overall target or choose categories to start tracking your budget.
                            </p>
                        ) : (
                            <ul className="divide-y rounded-md border">
                                {Object.entries(drafts)
                                    .sort(([left], [right]) => isOverallCategory(left) ? -1 : isOverallCategory(right) ? 1 : left.localeCompare(right))
                                    .map(([category, amount]) => (
                                        <li className="flex items-center justify-between gap-4 px-4 py-3" key={category}>
                                            <span className="font-medium">{isOverallCategory(category) ? "Overall" : category}</span>
                                            <span className="tabular-nums text-muted-foreground">
                                                {amount === "" ? "Amount needed" : formatCurrency(Number(amount))}
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
