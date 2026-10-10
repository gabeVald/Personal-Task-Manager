const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function toFiniteNumber(value, fallback = 0) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function formatCurrency(value) {
    const amount = typeof value === "number" ? value : Number(value);
    return Number.isFinite(amount) ? currencyFormatter.format(amount) : "—";
}
