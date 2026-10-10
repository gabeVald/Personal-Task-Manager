import Head from "next/head";
import { ArrowLeft, ExternalLink, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KiboMonthlySpendingDemo } from "@/components/KiboMonthlySpendingDemo";
import { TremorRawMonthlySpendingDemo } from "@/components/TremorRawMonthlySpendingDemo";
import { BklitMonthlySpendingDemo } from "@/components/BklitMonthlySpendingDemo";
import { formatDemoCurrency, getDemoMonthTotal, monthlySpendingDemoData } from "@/lib/spending-demo-data";

const latestMonth = monthlySpendingDemoData[monthlySpendingDemoData.length - 1];
const previousMonth = monthlySpendingDemoData[monthlySpendingDemoData.length - 2];
const latestTotal = getDemoMonthTotal(latestMonth);
const previousTotal = getDemoMonthTotal(previousMonth);
const monthChange = latestTotal - previousTotal;

const demoOptions = [
    {
        name: "Kibo UI patterns",
        subtitle: "Copy-in Recharts pattern · familiar shadcn styling",
        description: "A restrained stacked-column view using the app's existing shadcn chart wrapper. Hover for values; the category colors and layout stay close to the rest of the interface.",
        docs: "https://github.com/shadcnblocks/kibo/tree/main/packages/patterns/chart/bar",
        component: KiboMonthlySpendingDemo,
    },
    {
        name: "Tremor Raw",
        subtitle: "Dashboard-first Recharts styling · custom tooltip and legend",
        description: "A compact dashboard treatment with quiet axes, a rounded tooltip, and a readable category legend. This demo adapts Tremor Raw's copy-in approach to the app's color tokens.",
        docs: "https://www.tremor.so/docs/visualizations/bar-chart",
        component: TremorRawMonthlySpendingDemo,
    },
    {
        name: "Bklit UI",
        subtitle: "Visx renderer · animated bars and floating crosshair tooltip",
        description: "A more expressive registry component with animated columns, custom SVG rendering, and a hover-following tooltip. It uses a separate chart engine from Recharts.",
        docs: "https://bklit.com/docs/components/bar-chart",
        component: BklitMonthlySpendingDemo,
    },
];

export default function VisualizationDemosPage() {
    return (
        <>
            <Head>
                <title>Spending Chart Demos</title>
                <meta name="description" content="Compare shadcn-compatible monthly spending chart approaches using synthetic data." />
            </Head>
            <main className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <FlaskConical className="size-4" />
                            Visualization lab
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight">Compare monthly spending charts</h1>
                        <p className="max-w-2xl text-muted-foreground">
                            Same twelve months, same categories, three shadcn-friendly approaches. All amounts below are invented demo data; this page does not read the database or your transaction imports.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => (window.location.href = "/budget")}>
                        <ArrowLeft className="mr-2 size-4" />
                        Back to budget
                    </Button>
                </header>

                <section className="grid gap-4 sm:grid-cols-3" aria-label="Sample month summary">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Sample month</CardDescription>
                            <CardTitle className="text-base">{latestMonth.month}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold tabular-nums">{formatDemoCurrency(latestTotal)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">Net sample spending</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Month-over-month</CardDescription>
                            <CardTitle className="text-base">Compared with {previousMonth.month}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold tabular-nums">+{formatDemoCurrency(monthChange)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">A deliberately visible seasonal increase in the dummy data</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Comparison goal</CardDescription>
                            <CardTitle className="text-base">What changed each month?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Compare monthly totals first, then use category segments and tooltips to see which kinds of spending explain the movement.
                            </p>
                        </CardContent>
                    </Card>
                </section>

                <div className="space-y-6">
                    {demoOptions.map(({ name, subtitle, description, docs, component: Chart }) => (
                        <Card key={name}>
                            <CardHeader className="gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                    <CardTitle>{name}</CardTitle>
                                    <CardDescription>{subtitle}</CardDescription>
                                </div>
                                <a
                                    href={docs}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    View source <ExternalLink className="size-3.5" />
                                </a>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Chart />
                                <p className="text-sm text-muted-foreground">{description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <footer className="border-t pt-5 text-sm text-muted-foreground">
                    These are visual prototypes, not production summaries. Once a direction is chosen, the selected design can be connected to real monthly/category aggregates.
                </footer>
            </main>
        </>
    );
}
