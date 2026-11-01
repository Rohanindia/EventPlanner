"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import type { Plan, VendorItem } from "@/lib/validation";
import { VENDOR_STATUSES } from "@/lib/validation";
import { formatMoney } from "@/lib/money";
import { formatDate, countdownDays, isOverdue, generateICS } from "@/lib/dates";
import {
  generateBudgetCSV,
  generateTextSummary,
  triggerDownload,
  generatePlanJSON,
} from "@/lib/export";
import { writePlanImmediate } from "@/lib/storage";
import { AssistantPanel } from "./AssistantPanel";

// ===== Tab definitions =====
const TAB_IDS = ["overview", "budget", "timeline", "vendors", "ideas", "assistant"] as const;
type TabId = (typeof TAB_IDS)[number];
const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  budget: "Budget",
  timeline: "Timeline",
  vendors: "Vendors",
  ideas: "Ideas",
  assistant: "Assistant",
};

interface DashboardProps {
  plan: Plan;
  isAiGenerated: boolean;
  onPlanUpdate: (plan: Plan) => void;
}

export function Dashboard({ plan, isAiGenerated, onPlanUpdate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>(
    {} as Record<TabId, HTMLButtonElement | null>,
  );

  const updatePlan = useCallback(
    (updates: Partial<Plan>) => {
      const updated = { ...plan, ...updates, updatedAt: new Date().toISOString().slice(0, 10) };
      onPlanUpdate(updated);
      writePlanImmediate(updated);
    },
    [plan, onPlanUpdate],
  );

  // Roving tabindex for WAI-ARIA Tabs pattern
  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: TabId) => {
    const idx = TAB_IDS.indexOf(current);
    let next: TabId | undefined;
    if (e.key === "ArrowRight") next = TAB_IDS[(idx + 1) % TAB_IDS.length];
    if (e.key === "ArrowLeft") next = TAB_IDS[(idx - 1 + TAB_IDS.length) % TAB_IDS.length];
    if (e.key === "Home") next = TAB_IDS[0];
    if (e.key === "End") next = TAB_IDS[TAB_IDS.length - 1];
    if (next) {
      e.preventDefault();
      setActiveTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* AI badge */}
      {!isAiGenerated && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "0.5rem 1rem",
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "var(--radius)",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          ⚠️ Template plan — AI offline. Configure an API key for personalised AI-generated plans.
        </div>
      )}

      {/* Header */}
      <header style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          🎉 {plan.input.name}
        </h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
          {plan.input.eventType.charAt(0).toUpperCase() + plan.input.eventType.slice(1)} ·{" "}
          {formatDate(plan.input.date)} · {plan.input.city} · {plan.input.guests} guests
        </p>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Plan sections"
        style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", overflowX: "auto" }}
      >
        {TAB_IDS.map((tab) => (
          <button
            key={tab}
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            ref={(el) => {
              tabRefs.current[tab] = el;
            }}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(e) => handleTabKeyDown(e, tab)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius) var(--radius) 0 0",
              border: "none",
              background: activeTab === tab ? "var(--color-accent)" : "var(--color-bg-subtle)",
              color: activeTab === tab ? "white" : "var(--color-text)",
              fontWeight: activeTab === tab ? 700 : 400,
              cursor: "pointer",
              fontSize: "0.875rem",
              whiteSpace: "nowrap",
              minHeight: 44,
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {TAB_IDS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          hidden={activeTab !== tab}
          tabIndex={0}
          style={{ outline: "none" }}
        >
          {tab === "overview" && <OverviewPanel plan={plan} />}
          {tab === "budget" && <BudgetPanel plan={plan} onUpdate={updatePlan} />}
          {tab === "timeline" && <TimelinePanel plan={plan} onUpdate={updatePlan} />}
          {tab === "vendors" && <VendorsPanel plan={plan} onUpdate={updatePlan} />}
          {tab === "ideas" && <IdeasPanel plan={plan} onUpdate={updatePlan} />}
          {tab === "assistant" && <AssistantPanel plan={plan} />}
        </div>
      ))}
    </div>
  );
}

// ===== Overview Tab =====
function OverviewPanel({ plan }: { plan: Plan }) {
  const totalPlanned = plan.budget.reduce((s, i) => s + i.planned, 0);
  const totalActual = plan.budget.reduce((s, i) => s + i.actual, 0);
  const totalDone = plan.timeline.filter((t) => t.done).length;
  const countdown = countdownDays(plan.input.date);

  // Build donut SVG data
  const chartSize = 200;
  const radius = 80;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  let cumulative = 0;

  const COLORS = [
    "#c9973a",
    "#e05c3a",
    "#2980b9",
    "#27ae60",
    "#8e44ad",
    "#d35400",
    "#16a085",
    "#c0392b",
    "#2c3e50",
    "#f39c12",
  ];

  const slices = plan.budget
    .filter((b) => b.planned > 0)
    .slice(0, 10)
    .map((b, i) => {
      const pct = totalPlanned > 0 ? b.planned / totalPlanned : 0;
      const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      cumulative += pct;
      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const large = pct > 0.5 ? 1 : 0;
      const color = COLORS[i % COLORS.length] ?? "#888";
      return {
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`,
        color,
        category: b.category,
        planned: b.planned,
        pct,
      };
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary */}
      <p style={{ color: "var(--color-text)" }}>{plan.summary}</p>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
        }}
      >
        {[
          { label: "Days to Event", value: countdown, icon: "📅" },
          { label: "Tasks Done", value: `${totalDone} / ${plan.timeline.length}`, icon: "✅" },
          {
            label: "Budget Used",
            value: formatMoney(totalActual, plan.input.currency),
            icon: "💰",
          },
          {
            label: "Remaining",
            value: formatMoney(totalPlanned - totalActual, plan.input.currency),
            icon: "🏦",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "1rem",
              background: "var(--color-bg-card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--color-border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5rem" }} aria-hidden="true">
              {stat.icon}
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-accent)" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Donut chart + accessible table */}
      <div>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>Budget Breakdown</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "flex-start" }}>
          <svg
            width={chartSize}
            height={chartSize}
            role="img"
            aria-label="Budget allocation donut chart"
            style={{ flexShrink: 0 }}
          >
            <title>Budget Allocation</title>
            {slices.map((s, i) => (
              <path key={i} d={s.path} fill={s.color} />
            ))}
            <circle cx={cx} cy={cy} r={45} fill="var(--color-bg-card)" />
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-text-muted)"
            >
              Total
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fontSize="13"
              fontWeight="bold"
              fill="var(--color-text)"
            >
              {formatMoney(totalPlanned, plan.input.currency, { compact: true })}
            </text>
          </svg>

          {/* Accessible data table equivalent */}
          <div style={{ overflowX: "auto", flex: 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.875rem" }}>
              <caption className="sr-only">Budget allocation by category</caption>
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>
                    Category
                  </th>
                  <th scope="col" style={thStyle}>
                    Amount
                  </th>
                  <th scope="col" style={thStyle}>
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          background: s.color,
                          marginRight: 6,
                          borderRadius: 2,
                        }}
                        aria-hidden="true"
                      />
                      {s.category}
                    </td>
                    <td style={tdStyle}>{formatMoney(s.planned, plan.input.currency)}</td>
                    <td style={tdStyle}>{(s.pct * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export section */}
      <ExportPanel plan={plan} />
    </div>
  );
}

// ===== Budget Tab =====
function BudgetPanel({ plan, onUpdate }: { plan: Plan; onUpdate: (u: Partial<Plan>) => void }) {
  const total = plan.budget.reduce((s, i) => s + i.planned, 0);
  const totalActual = plan.budget.reduce((s, i) => s + i.actual, 0);
  const overBudget = totalActual > total;

  const updateItem = (
    id: string,
    field: "actual" | "notes" | "planned",
    value: number | string,
  ) => {
    const updated = plan.budget.map((b) => (b.id === id ? { ...b, [field]: value } : b));
    onUpdate({ budget: updated });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {overBudget && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius)",
          }}
        >
          ⚠️ You are <strong>{formatMoney(totalActual - total, plan.input.currency)}</strong> over
          budget!
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.875rem" }}>
          <caption
            style={{
              textAlign: "left",
              fontWeight: 600,
              marginBottom: "0.5rem",
              captionSide: "top",
            }}
          >
            Budget — {plan.input.currency} {formatMoney(total, plan.input.currency)} total
          </caption>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>
                Category
              </th>
              <th scope="col" style={thStyle}>
                Planned
              </th>
              <th scope="col" style={thStyle}>
                Actual
              </th>
              <th scope="col" style={thStyle}>
                Remaining
              </th>
              <th scope="col" style={thStyle}>
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.budget.map((item) => {
              const remaining = item.planned - item.actual;
              const isOver = remaining < 0;
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={tdStyle}>{item.category}</td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      min={0}
                      value={item.planned}
                      onChange={(e) => updateItem(item.id, "planned", Number(e.target.value))}
                      aria-label={`Planned budget for ${item.category}`}
                      style={{ ...numInputStyle, width: 100 }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      min={0}
                      value={item.actual}
                      onChange={(e) => updateItem(item.id, "actual", Number(e.target.value))}
                      aria-label={`Actual spend for ${item.category}`}
                      style={{ ...numInputStyle, width: 100 }}
                    />
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 600,
                      color: isOver ? "var(--color-danger)" : "var(--color-success)",
                    }}
                    aria-label={`${isOver ? "Over by" : "Remaining"}: ${formatMoney(Math.abs(remaining), plan.input.currency)}`}
                  >
                    {isOver ? "-" : ""}
                    {formatMoney(Math.abs(remaining), plan.input.currency)}
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                      maxLength={200}
                      aria-label={`Notes for ${item.category}`}
                      style={{ ...numInputStyle, width: 150 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td style={tdStyle}>Total</td>
              <td style={tdStyle}>{formatMoney(total, plan.input.currency)}</td>
              <td style={tdStyle}>{formatMoney(totalActual, plan.input.currency)}</td>
              <td
                style={{
                  ...tdStyle,
                  color: overBudget ? "var(--color-danger)" : "var(--color-success)",
                }}
              >
                {formatMoney(total - totalActual, plan.input.currency)}
              </td>
              <td style={tdStyle} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ===== Timeline Tab =====
function TimelinePanel({ plan, onUpdate }: { plan: Plan; onUpdate: (u: Partial<Plan>) => void }) {
  const toggleDone = (id: string) => {
    onUpdate({
      timeline: plan.timeline.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    });
  };

  const sorted = [...plan.timeline].sort((a, b) => a.date.localeCompare(b.date));
  const done = sorted.filter((t) => t.done).length;

  const handleICSExport = () => {
    const ics = generateICS(plan.timeline, plan.input.name, plan.input.date);
    triggerDownload(ics, `${plan.input.name}-timeline.ics`, "text/calendar");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>
          {done} of {sorted.length} tasks completed
        </p>
        <button onClick={handleICSExport} style={outlineBtnStyle}>
          📅 Export to Calendar (.ics)
        </button>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {sorted.map((item) => {
          const overdue = isOverdue(item);
          return (
            <li
              key={item.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.75rem",
                background: item.done
                  ? "var(--color-bg-subtle)"
                  : overdue
                    ? "#fef2f2"
                    : "var(--color-bg-card)",
                borderRadius: "var(--radius)",
                border: `1px solid ${overdue && !item.done ? "var(--color-danger)" : "var(--color-border)"}`,
              }}
            >
              <input
                type="checkbox"
                id={`task-${item.id}`}
                checked={item.done}
                onChange={() => toggleDone(item.id)}
                aria-label={`Mark "${item.task}" as ${item.done ? "incomplete" : "complete"}`}
                style={{ marginTop: 2, accentColor: "var(--color-accent)", width: 18, height: 18 }}
              />
              <label htmlFor={`task-${item.id}`} style={{ flex: 1, cursor: "pointer" }}>
                <span
                  style={{
                    display: "block",
                    fontWeight: 500,
                    textDecoration: item.done ? "line-through" : "none",
                    color: item.done ? "var(--color-text-muted)" : "var(--color-text)",
                  }}
                >
                  {item.task}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    marginTop: "0.2rem",
                    display: "block",
                  }}
                >
                  {formatDate(item.date)} · {item.category} ·{" "}
                  <span
                    style={{
                      color:
                        item.priority === "high"
                          ? "var(--color-danger)"
                          : item.priority === "medium"
                            ? "var(--color-warning)"
                            : "var(--color-success)",
                    }}
                  >
                    {item.priority} priority
                  </span>
                  {overdue && !item.done && (
                    <span
                      aria-label="overdue"
                      style={{ marginLeft: 4, color: "var(--color-danger)", fontWeight: 600 }}
                    >
                      {" "}
                      <span aria-hidden="true">⚠</span> Overdue
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ===== Vendors Tab =====
function VendorsPanel({ plan, onUpdate }: { plan: Plan; onUpdate: (u: Partial<Plan>) => void }) {
  const updateVendor = (id: string, updates: Partial<VendorItem>) => {
    onUpdate({
      vendors: plan.vendors.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {plan.vendors.map((vendor) => (
        <div
          key={vendor.id}
          style={{
            padding: "1rem",
            background: "var(--color-bg-card)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>{vendor.category}</h3>
            <select
              value={vendor.status}
              onChange={(e) =>
                updateVendor(vendor.id, {
                  status: e.target.value as (typeof VENDOR_STATUSES)[number],
                })
              }
              aria-label={`Status for ${vendor.category}`}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--color-border)",
                background: statusColor(vendor.status),
                color: "white",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            >
              {VENDOR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div>
              <label
                htmlFor={`vname-${vendor.id}`}
                style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block" }}
              >
                Vendor Name
              </label>
              <input
                id={`vname-${vendor.id}`}
                type="text"
                value={vendor.name}
                onChange={(e) => updateVendor(vendor.id, { name: e.target.value })}
                placeholder="Enter vendor name"
                maxLength={100}
                style={smallInputStyle}
              />
            </div>
            <div>
              <label
                htmlFor={`vcontact-${vendor.id}`}
                style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block" }}
              >
                Contact
              </label>
              <input
                id={`vcontact-${vendor.id}`}
                type="text"
                value={vendor.contact}
                onChange={(e) => updateVendor(vendor.id, { contact: e.target.value })}
                placeholder="Phone / email"
                maxLength={200}
                style={smallInputStyle}
              />
            </div>
            <div>
              <label
                htmlFor={`vquote-${vendor.id}`}
                style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block" }}
              >
                Quote ({plan.input.currency})
              </label>
              <input
                id={`vquote-${vendor.id}`}
                type="number"
                min={0}
                value={vendor.quotedAmount}
                onChange={(e) => updateVendor(vendor.id, { quotedAmount: Number(e.target.value) })}
                style={{ ...smallInputStyle, width: 120 }}
              />
            </div>
          </div>

          {vendor.questionsToAsk.length > 0 && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "var(--color-accent)",
                  fontWeight: 500,
                }}
              >
                Questions to ask ({vendor.questionsToAsk.length})
              </summary>
              <ul
                style={{
                  paddingLeft: "1.25rem",
                  marginTop: "0.5rem",
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                }}
              >
                {vendor.questionsToAsk.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function statusColor(status: VendorItem["status"]): string {
  switch (status) {
    case "not_started":
      return "#94a3b8";
    case "shortlisted":
      return "#3b82f6";
    case "quoted":
      return "#f59e0b";
    case "booked":
      return "#8b5cf6";
    case "paid":
      return "#22c55e";
    default:
      return "#94a3b8";
  }
}

// ===== Ideas Tab =====
function IdeasPanel({ plan, onUpdate }: { plan: Plan; onUpdate: (u: Partial<Plan>) => void }) {
  const togglePin = (id: string) => {
    const pinned = plan.ideas.pinnedIds.includes(id)
      ? plan.ideas.pinnedIds.filter((p) => p !== id)
      : [...plan.ideas.pinnedIds, id];
    onUpdate({ ideas: { ...plan.ideas, pinnedIds: pinned } });
  };

  const sections = [
    { key: "themes", label: "🎨 Themes", items: plan.ideas.themes },
    { key: "decorPalette", label: "🌸 Décor Palette", items: plan.ideas.decorPalette },
    { key: "menuSuggestions", label: "🍽️ Menu Suggestions", items: plan.ideas.menuSuggestions },
    { key: "activities", label: "🎭 Activities & Entertainment", items: plan.ideas.activities },
    { key: "favours", label: "🎁 Favours & Gifts", items: plan.ideas.favours },
    { key: "moneySavingTips", label: "💡 Money-Saving Tips", items: plan.ideas.moneySavingTips },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {sections.map(({ key, label, items }) => (
        <section key={key} aria-labelledby={`ideas-${key}`}>
          <h2 id={`ideas-${key}`} style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
            {label}
          </h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            {items.map((item, i) => {
              const id = `${key}-${i}`;
              const isPinned = plan.ideas.pinnedIds.includes(id);
              return (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    background: isPinned ? "var(--color-bg-subtle)" : "transparent",
                    borderRadius: "var(--radius)",
                    border: isPinned
                      ? "1px solid var(--color-accent-light)"
                      : "1px solid transparent",
                  }}
                >
                  <span style={{ flex: 1, fontSize: "0.9rem" }}>{item}</span>
                  <button
                    onClick={() => togglePin(id)}
                    aria-label={isPinned ? `Unpin: ${item}` : `Pin: ${item}`}
                    aria-pressed={isPinned}
                    title={isPinned ? "Unpin" : "Pin this idea"}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1rem",
                      padding: "0.25rem",
                      minHeight: 44,
                      minWidth: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isPinned ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    {isPinned ? "📌" : "📍"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ===== Export Panel =====
function ExportPanel({ plan }: { plan: Plan }) {
  const [copied, setCopied] = useState(false);

  const handleCopyText = async () => {
    try {
      const text = generateTextSummary(plan);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn("[export] Clipboard copy failed");
    }
  };

  return (
    <section aria-labelledby="export-heading">
      <h2 id="export-heading" style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
        Export &amp; Share
      </h2>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={() =>
            triggerDownload(
              generatePlanJSON(plan),
              `${plan.input.name}-plan.json`,
              "application/json",
            )
          }
          style={outlineBtnStyle}
        >
          ⬇ JSON
        </button>
        <button
          onClick={() =>
            triggerDownload(
              generateBudgetCSV(plan.budget, plan.input.currency),
              `${plan.input.name}-budget.csv`,
              "text/csv",
            )
          }
          style={outlineBtnStyle}
        >
          ⬇ Budget CSV
        </button>
        <button
          onClick={() =>
            triggerDownload(
              generateICS(plan.timeline, plan.input.name, plan.input.date),
              `${plan.input.name}-timeline.ics`,
              "text/calendar",
            )
          }
          style={outlineBtnStyle}
        >
          ⬇ Calendar ICS
        </button>
        <button onClick={handleCopyText} aria-live="polite" style={outlineBtnStyle}>
          {copied ? "✅ Copied!" : "📋 Copy Text"}
        </button>
        <button onClick={() => window.print()} style={outlineBtnStyle}>
          🖨 Print
        </button>
      </div>
    </section>
  );
}

// ===== Shared styles =====
const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  borderBottom: "2px solid var(--color-border)",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  verticalAlign: "middle",
  fontSize: "0.875rem",
};

const numInputStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
};

const smallInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.375rem 0.5rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: "0.875rem",
};

const outlineBtnStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-bg-card)",
  color: "var(--color-text)",
  cursor: "pointer",
  fontSize: "0.875rem",
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  gap: "0.25rem",
};
