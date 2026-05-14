import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "react-router";
import { useState } from "react";
import { useDashboardTrends, type TrendDataPoint } from "../lib/queries/dashboard";
import { useAppStore } from "../store/appStore";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

const INCOME_COLOR = "hsl(142 71% 45%)";
const EXPENSES_COLOR = "hsl(0 72% 51%)";

type SeriesKey = "income" | "expenses";
type Visibility = Record<SeriesKey, boolean>;
type ChartStyle = "line" | "bar";

export const LABEL_COUNT_OPTIONS = [5, 10, 15, 20, 30] as const;
export type LabelCount = (typeof LABEL_COUNT_OPTIONS)[number];

export type Granularity = "auto" | "day" | "week" | "month" | "quarter" | "year";

/**
 * Pick the coarsest granularity that keeps the bucket count visually manageable.
 * Daily becomes unreadable past ~90 days; week/month/quarter scale up smoothly.
 */
export function pickGranularity(dayCount: number): Exclude<Granularity, "auto"> {
  if (dayCount <= 90) return "day";
  if (dayCount <= 365 * 2) return "week";
  if (dayCount <= 365 * 6) return "month";
  if (dayCount <= 365 * 20) return "quarter";
  return "year";
}

/**
 * Downsample daily TrendDataPoints into the chosen bucket size.
 * Returns one entry per bucket with summed income/expenses.
 * Pure, deterministic. Bucket date = first day of the bucket period.
 */
export function bucketize(
  points: TrendDataPoint[],
  granularity: Exclude<Granularity, "auto">,
): TrendDataPoint[] {
  if (points.length === 0) return [];
  if (granularity === "day") return points;

  const buckets = new Map<string, TrendDataPoint>();

  for (const p of points) {
    const d = new Date(`${p.date}T00:00:00Z`);
    if (isNaN(d.getTime())) {
      if (import.meta.env.DEV) {
        console.error(`bucketize: skipping point with unparseable date "${p.date}"`);
      }
      continue;
    }

    let bucketDate: string;
    if (granularity === "week") {
      // Week starts Monday (ISO). Shift to Monday of this week.
      // Note: when the user's range starts on a non-Monday, the first bucket
      // label will be the Monday at-or-before that date (which precedes the
      // selected range). Sums are still correct — only days inside the range
      // contribute. Documented contract: bucket labels mark the ISO week start.
      const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
      const offset = (day + 6) % 7; // days since Monday
      const monday = new Date(d.getTime() - offset * 86_400_000);
      bucketDate = monday.toISOString().slice(0, 10);
    } else if (granularity === "month") {
      bucketDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    } else if (granularity === "quarter") {
      const q = Math.floor(d.getUTCMonth() / 3);
      const startMonth = q * 3 + 1;
      bucketDate = `${d.getUTCFullYear()}-${String(startMonth).padStart(2, "0")}-01`;
    } else {
      bucketDate = `${d.getUTCFullYear()}-01-01`;
    }

    const existing = buckets.get(bucketDate);
    if (existing) {
      existing.income += p.income;
      existing.expenses += p.expenses;
    } else {
      buckets.set(bucketDate, { date: bucketDate, income: p.income, expenses: p.expenses });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Format date string (YYYY-MM-DD) to readable month label (Jan 2026) */
export function formatMonthLabel(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Format date string (YYYY-MM-DD) to a full date label (1 Jan 2026) */
export function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole-day difference (end − start). Exclusive of the start day. Returns 0 for invalid input or when end < start. */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

/** Format Y-axis values as compact CHF amounts (e.g. CHF 1.5k, CHF 500) */
export function formatYAxisValue(value: number): string {
  if (!isFinite(value)) return "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) {
    return `${sign}CHF ${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}CHF ${Math.round(abs)}`;
}

/**
 * Recharts XAxis `interval` skips N ticks between rendered labels. Compute the
 * smallest interval that keeps total visible labels at or below `maxLabels`.
 */
export function computeTickInterval(pointCount: number, maxLabels: number): number {
  if (maxLabels <= 0 || pointCount <= maxLabels) return 0;
  return Math.ceil(pointCount / maxLabels) - 1;
}

/** Maximum number of buckets included verbatim in the aria-label. Beyond this
 * the description summarizes head + tail and reports the total count, so
 * screen readers don't have to read multi-KB strings on long ranges. */
export const ARIA_LABEL_BUCKET_CAP = 12;

/** Build a screen-reader description summarizing the displayed trend data. */
export function buildChartAriaLabel(
  points: TrendDataPoint[],
  t: TFunction<"translation", undefined>,
  formatter: (date: string) => string = formatMonthLabel,
): string {
  if (points.length === 0)
    return t("components.spendingTrendChart.aria.empty", "Income and expenses chart, no data.");

  const describe = (p: TrendDataPoint) =>
    t(
      "components.spendingTrendChart.aria.describe",
      "{{date}}: income {{income}}, expenses {{expenses}}",
      {
        date: formatter(p.date),
        income: formatCurrency(p.income),
        expenses: formatCurrency(p.expenses),
      },
    );

  if (points.length <= ARIA_LABEL_BUCKET_CAP) {
    return t(
      "components.spendingTrendChart.aria.short",
      "Income and expenses chart. {{details}}.",
      { details: points.map(describe).join(". ") },
    );
  }

  const head = points.slice(0, ARIA_LABEL_BUCKET_CAP / 2).map(describe);
  const tail = points.slice(-ARIA_LABEL_BUCKET_CAP / 2).map(describe);
  const skipped = points.length - head.length - tail.length;
  return t(
    "components.spendingTrendChart.aria.long",
    "Income and expenses chart with {{total}} periods. {{head}}. … {{skipped}} periods omitted. {{tail}}.",
    { total: points.length, head: head.join(". "), skipped, tail: tail.join(". ") },
  );
}

const CARD_CLASSES = "col-span-1 sm:col-span-2 lg:col-span-3";

function ChartTitle() {
  const { t } = useTranslation();
  return (
    <CardTitle className="text-xs font-semibold uppercase tracking-wider">
      {t("components.spendingTrendChart.title", "Monthly Income vs. Expenses")}
    </CardTitle>
  );
}

function ViewTransactionsLink({ href }: { href: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {t("components.spendingTrendChart.viewTransactions", "View transactions →")}
    </Link>
  );
}

function StyleOption({
  label,
  name,
  value,
  active,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
}) {
  // Native <input type="radio"> gives us free keyboard semantics for the
  // surrounding radiogroup: arrow keys cycle, Home/End jump, focus follows
  // selection. The label wrapper is the visible button-like surface; the
  // actual input is visually hidden but reachable.
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-primary ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/30"
      }`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function SeriesToggle({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-opacity hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ opacity: active ? 1 : 0.4 }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </button>
  );
}

export function SpendingTrendChart() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const { data, isLoading, error } = useDashboardTrends();
  const [visible, setVisible] = useState<Visibility>({ income: true, expenses: true });
  const [chartStyle, setChartStyle] = useState<ChartStyle>("line");
  const [labelCount, setLabelCount] = useState<LabelCount>(15);
  const [granularity, setGranularity] = useState<Granularity>("auto");
  const { t } = useTranslation();

  if (import.meta.env.DEV && data !== undefined && !Array.isArray(data)) {
    console.error("SpendingTrendChart: expected array from useDashboardTrends, got", typeof data);
  }
  const chartData = Array.isArray(data) ? data : [];
  const hasData = chartData.length > 0;
  const transactionsHref = `/transactions?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  if (error) {
    if (import.meta.env.DEV) {
      console.error("SpendingTrendChart: failed to load trends", error);
    }
    return (
      <div
        role="alert"
        className="col-span-1 sm:col-span-2 lg:col-span-3 rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
      >
        {t(
          "components.spendingTrendChart.states.error",
          "Failed to load spending trend data. Please try again.",
        )}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <Card className={CARD_CLASSES}>
        <CardHeader>
          <ChartTitle />
        </CardHeader>
        <CardContent>
          <div className="flex h-80 items-center justify-center rounded bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {t("components.spendingTrendChart.states.loading", "Loading chart…")}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className={CARD_CLASSES}>
        <CardHeader>
          <ChartTitle />
        </CardHeader>
        <CardContent>
          <div className="flex h-80 items-center justify-center rounded bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t(
                "components.spendingTrendChart.states.empty",
                "No spending data for the selected period. Adjust the date range or import transactions.",
              )}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <ViewTransactionsLink href={transactionsHref} />
          </div>
        </CardContent>
      </Card>
    );
  }

  const toggle = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Don't allow hiding both — at least one series must be visible
      if (!next.income && !next.expenses) return prev;
      return next;
    });
  };

  const effectiveGranularity =
    granularity === "auto" ? pickGranularity(chartData.length) : granularity;
  const buckets = bucketize(chartData, effectiveGranularity);
  const tickInterval = computeTickInterval(buckets.length, labelCount);
  // Use full-date format for fine-grained buckets; compact month-only for coarser ones.
  const xAxisFormatter =
    effectiveGranularity === "day" || effectiveGranularity === "week"
      ? formatDateLabel
      : formatMonthLabel;

  if (buckets.length === 1 && buckets[0]) {
    const only = buckets[0];
    return (
      <Card className={CARD_CLASSES}>
        <CardHeader>
          <ChartTitle />
        </CardHeader>
        <CardContent>
          <div className="flex h-80 flex-col items-center justify-center gap-2 rounded bg-muted/30 p-8 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {xAxisFormatter(only.date)}
            </p>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1">
              <dt className="text-sm text-muted-foreground">
                {t("components.spendingTrendChart.income", "Income")}
              </dt>
              <dd className="text-sm font-medium tabular-nums">{formatCurrency(only.income)}</dd>
              <dt className="text-sm text-muted-foreground">
                {t("components.spendingTrendChart.expenses", "Expenses")}
              </dt>
              <dd className="text-sm font-medium tabular-nums">{formatCurrency(only.expenses)}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "components.spendingTrendChart.singleBucketHelp",
                "Adjust the date range or pick a finer granularity to see a trend.",
              )}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <ViewTransactionsLink href={transactionsHref} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASSES}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChartTitle />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="sr-only sm:not-sr-only">
                {t("components.spendingTrendChart.controls.bucket", "Bucket")}
              </span>
              <select
                aria-label={t(
                  "components.spendingTrendChart.controls.granularityAria",
                  "Granularity",
                )}
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
                className="rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="auto">
                  {t("components.spendingTrendChart.controls.options.auto", "Auto")}
                </option>
                <option value="day">
                  {t("components.spendingTrendChart.controls.options.day", "Day")}
                </option>
                <option value="week">
                  {t("components.spendingTrendChart.controls.options.week", "Week")}
                </option>
                <option value="month">
                  {t("components.spendingTrendChart.controls.options.month", "Month")}
                </option>
                <option value="quarter">
                  {t("components.spendingTrendChart.controls.options.quarter", "Quarter")}
                </option>
                <option value="year">
                  {t("components.spendingTrendChart.controls.options.year", "Year")}
                </option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="sr-only sm:not-sr-only">
                {t("components.spendingTrendChart.controls.labels", "Labels")}
              </span>
              <select
                aria-label={t(
                  "components.spendingTrendChart.controls.labelsAria",
                  "Number of axis labels",
                )}
                value={labelCount}
                onChange={(e) => setLabelCount(Number(e.target.value) as LabelCount)}
                className="rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {LABEL_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <fieldset
              aria-label={t("components.spendingTrendChart.controls.chartStyleAria", "Chart style")}
              className="inline-flex items-center gap-0.5 rounded border border-border p-0.5"
            >
              <StyleOption
                label={t("components.spendingTrendChart.controls.line", "Line")}
                name="chart-style"
                value="line"
                active={chartStyle === "line"}
                onChange={(v) => setChartStyle(v as ChartStyle)}
              />
              <StyleOption
                label={t("components.spendingTrendChart.controls.bar", "Bar")}
                name="chart-style"
                value="bar"
                active={chartStyle === "bar"}
                onChange={(v) => setChartStyle(v as ChartStyle)}
              />
            </fieldset>
            <div
              role="group"
              aria-label={t(
                "components.spendingTrendChart.controls.toggleSeriesAria",
                "Toggle chart series",
              )}
              className="flex items-center gap-1"
            >
              <SeriesToggle
                label={t("components.spendingTrendChart.income", "Income")}
                color={INCOME_COLOR}
                active={visible.income}
                onClick={() => toggle("income")}
              />
              <SeriesToggle
                label={t("components.spendingTrendChart.expenses", "Expenses")}
                color={EXPENSES_COLOR}
                active={visible.expenses}
                onClick={() => toggle("expenses")}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <figure
          role="img"
          aria-label={buildChartAriaLabel(buckets, t, xAxisFormatter)}
          className="h-80 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartStyle === "line" ? (
              <LineChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={xAxisFormatter}
                  interval={tickInterval}
                  minTickGap={0}
                  height={48}
                  stroke="var(--border)"
                  style={{ fontSize: "12px" }}
                  tick={{
                    fill: "var(--foreground)",
                    angle: -35,
                    textAnchor: "end",
                  }}
                  tickMargin={8}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tickFormatter={formatYAxisValue}
                  domain={[0, "auto"]}
                  stroke="var(--border)"
                  style={{ fontSize: "13px" }}
                  tick={{ fill: "var(--foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  width={84}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ color: "var(--foreground)" }}
                  formatter={(value, name) => {
                    const num = Number(value);
                    return [isFinite(num) ? formatCurrency(num) : "—", name];
                  }}
                  cursor={{ stroke: "hsl(0 0% 50% / 0.4)" }}
                />
                <Line
                  type="linear"
                  dataKey="income"
                  name={t("components.spendingTrendChart.income", "Income")}
                  hide={!visible.income}
                  stroke={INCOME_COLOR}
                  strokeWidth={2}
                  dot={{ fill: INCOME_COLOR, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="expenses"
                  name={t("components.spendingTrendChart.expenses", "Expenses")}
                  hide={!visible.expenses}
                  stroke={EXPENSES_COLOR}
                  strokeWidth={2}
                  dot={{ fill: EXPENSES_COLOR, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={xAxisFormatter}
                  interval={tickInterval}
                  minTickGap={0}
                  height={48}
                  stroke="var(--border)"
                  style={{ fontSize: "12px" }}
                  tick={{
                    fill: "var(--foreground)",
                    angle: -35,
                    textAnchor: "end",
                  }}
                  tickMargin={8}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tickFormatter={formatYAxisValue}
                  domain={[0, "auto"]}
                  stroke="var(--border)"
                  style={{ fontSize: "13px" }}
                  tick={{ fill: "var(--foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  width={84}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ color: "var(--foreground)" }}
                  formatter={(value, name) => {
                    const num = Number(value);
                    return [isFinite(num) ? formatCurrency(num) : "—", name];
                  }}
                  cursor={{ fill: "hsl(0 0% 50% / 0.1)" }}
                />
                <Bar
                  dataKey="income"
                  name={t("components.spendingTrendChart.income", "Income")}
                  hide={!visible.income}
                  fill={INCOME_COLOR}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="expenses"
                  name={t("components.spendingTrendChart.expenses", "Expenses")}
                  hide={!visible.expenses}
                  fill={EXPENSES_COLOR}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </figure>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {t(
              "components.spendingTrendChart.footerSummary",
              "Showing {{count}} {{granularity}} of income and expenses.",
              {
                count: buckets.length,
                granularity: t(
                  `components.spendingTrendChart.granularities.${effectiveGranularity}`,
                  { count: buckets.length },
                ),
              },
            )}
          </p>
          <ViewTransactionsLink href={transactionsHref} />
        </div>
      </CardContent>
    </Card>
  );
}
