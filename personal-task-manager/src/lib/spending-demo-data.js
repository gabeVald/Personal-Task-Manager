export const spendingDemoCategories = [
    { key: "bills", label: "Bills & subscriptions", color: "var(--chart-1)" },
    { key: "food", label: "Food & dining", color: "var(--chart-2)" },
    { key: "shopping", label: "Shopping", color: "var(--chart-3)" },
    { key: "travel", label: "Travel & transport", color: "var(--chart-4)" },
    { key: "health", label: "Health & personal care", color: "var(--chart-5)" },
];

export const monthlySpendingDemoData = [
    { month: "Jan '25", bills: 1420, food: 620, shopping: 385, travel: 260, health: 135 },
    { month: "Feb '25", bills: 1450, food: 580, shopping: 220, travel: 190, health: 110 },
    { month: "Mar '25", bills: 1470, food: 640, shopping: 410, travel: 300, health: 160 },
    { month: "Apr '25", bills: 1430, food: 610, shopping: 340, travel: 210, health: 120 },
    { month: "May '25", bills: 1460, food: 680, shopping: 510, travel: 420, health: 140 },
    { month: "Jun '25", bills: 1490, food: 650, shopping: 360, travel: 330, health: 150 },
    { month: "Jul '25", bills: 1435, food: 700, shopping: 290, travel: 580, health: 210 },
    { month: "Aug '25", bills: 1465, food: 670, shopping: 440, travel: 300, health: 135 },
    { month: "Sep '25", bills: 1410, food: 630, shopping: 315, travel: 230, health: 185 },
    { month: "Oct '25", bills: 1455, food: 720, shopping: 480, travel: 280, health: 165 },
    { month: "Nov '25", bills: 1480, food: 760, shopping: 760, travel: 350, health: 220 },
    { month: "Dec '25", bills: 1520, food: 820, shopping: 910, travel: 410, health: 240 },
];

export const formatDemoCurrency = (amount) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount);

export const formatDemoAxisCurrency = (amount) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
    return `$${amount}`;
};

export const getDemoMonthTotal = (month) =>
    spendingDemoCategories.reduce((total, category) => total + month[category.key], 0);
