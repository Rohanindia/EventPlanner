"use client";

import { useState, useEffect, useRef } from "react";
import type { Plan } from "@/lib/validation";
import { EventWizard } from "@/features/wizard/EventWizard";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { listPlans, writePlanImmediate, deletePlan, eraseAllData } from "@/lib/storage";
import { formatDate, countdownDays } from "@/lib/dates";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type AppView = "home" | "wizard" | "dashboard" | "events";

export default function HomePage() {
  const [view, setView] = useState<AppView>("home");
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setSavedPlans(listPlans());
  }, []);

  const handlePlanGenerated = (plan: Plan, aiGenerated: boolean) => {
    writePlanImmediate(plan);
    setActivePlan(plan);
    setIsAiGenerated(aiGenerated);
    setSavedPlans(listPlans());
    setView("dashboard");
    // Move focus to results heading after generation
    setTimeout(() => resultsHeadingRef.current?.focus(), 100);
  };

  const handlePlanUpdate = (plan: Plan) => {
    writePlanImmediate(plan);
    setActivePlan(plan);
    setSavedPlans(listPlans());
  };

  const handleDeletePlan = (id: string) => {
    deletePlan(id);
    setSavedPlans(listPlans());
    if (activePlan?.id === id) {
      setActivePlan(null);
      setView("home");
    }
  };

  const handleEraseAll = () => {
    if (window.confirm("Erase ALL saved plans? This cannot be undone.")) {
      eraseAllData();
      setSavedPlans([]);
      setActivePlan(null);
      setView("home");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Header nav */}
      <header
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-card)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
        role="banner"
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 1rem",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setView("home")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.25rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minHeight: 44,
            }}
            aria-label="Jashn – go to home"
          >
            🎉 Jashn
          </button>

          <nav aria-label="Main navigation">
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                gap: "0.25rem",
                margin: 0,
                padding: 0,
                alignItems: "center",
              }}
            >
              <li>
                <button onClick={() => setView("wizard")} style={navBtnStyle(view === "wizard")}>
                  + New Plan
                </button>
              </li>
              {savedPlans.length > 0 && (
                <li>
                  <button onClick={() => setView("events")} style={navBtnStyle(view === "events")}>
                    My Events ({savedPlans.length})
                  </button>
                </li>
              )}
              {activePlan && (
                <li>
                  <button
                    onClick={() => setView("dashboard")}
                    style={navBtnStyle(view === "dashboard")}
                  >
                    Dashboard
                  </button>
                </li>
              )}
              <li>
                <ThemeToggle />
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
        {/* Home view */}
        {view === "home" && (
          <div>
            {/* Hero */}
            <section
              aria-labelledby="hero-heading"
              style={{
                textAlign: "center",
                padding: "4rem 1.5rem 3rem",
                background:
                  "linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-subtle) 100%)",
              }}
            >
              <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }} aria-hidden="true">
                🎉
              </p>
              <h1
                id="hero-heading"
                style={{
                  fontSize: "clamp(1.75rem, 5vw, 3rem)",
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                  marginBottom: "1rem",
                }}
              >
                Plan Your Perfect <span style={{ color: "var(--color-accent)" }}>Celebration</span>
              </h1>
              <p
                style={{
                  fontSize: "1.125rem",
                  color: "var(--color-text-muted)",
                  maxWidth: 540,
                  margin: "0 auto 2rem",
                  lineHeight: 1.6,
                }}
              >
                AI-powered planning for weddings, birthdays &amp; community events — with budgets,
                timelines, vendor checklists, and personalised ideas.
              </p>
              <button
                onClick={() => setView("wizard")}
                style={{
                  padding: "0.875rem 2.5rem",
                  background: "var(--color-accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 52,
                }}
              >
                ✨ Start Planning
              </button>
            </section>

            {/* Feature highlights */}
            <section aria-labelledby="features-heading" style={{ padding: "3rem 1.5rem" }}>
              <h2
                id="features-heading"
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: "1.5rem",
                  marginBottom: "2rem",
                  fontFamily: "var(--font-display)",
                }}
              >
                Everything you need
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1.5rem",
                  maxWidth: 900,
                  margin: "0 auto",
                }}
              >
                {[
                  {
                    icon: "💰",
                    title: "Smart Budget",
                    desc: "Allocate across categories, track actuals, get over-budget alerts.",
                  },
                  {
                    icon: "📅",
                    title: "Timeline",
                    desc: "Dated tasks counted from your event. Export to Google Calendar.",
                  },
                  {
                    icon: "🤝",
                    title: "Vendor Tracker",
                    desc: "Track quotes, status, and questions for every vendor category.",
                  },
                  {
                    icon: "✨",
                    title: "AI Ideas",
                    desc: "Personalised themes, menu, activities, and money-saving tips.",
                  },
                  {
                    icon: "🔒",
                    title: "Private & Offline",
                    desc: "Your plan stays in your browser. Nothing stored server-side.",
                  },
                  {
                    icon: "♿",
                    title: "Accessible",
                    desc: "Built to WCAG 2.2 AA. Works with keyboard and screen readers.",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    style={{
                      padding: "1.25rem",
                      background: "var(--color-bg-card)",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }} aria-hidden="true">
                      {f.icon}
                    </div>
                    <h3 style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{f.title}</h3>
                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                      {f.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent events */}
            {savedPlans.length > 0 && (
              <section
                aria-labelledby="recent-heading"
                style={{ padding: "0 1.5rem 3rem", maxWidth: 900, margin: "0 auto" }}
              >
                <h2 id="recent-heading" style={{ fontWeight: 600, marginBottom: "1rem" }}>
                  Recent Events
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {savedPlans
                    .slice(-3)
                    .reverse()
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActivePlan(p);
                          setIsAiGenerated(p.isAiGenerated);
                          setView("dashboard");
                        }}
                        aria-label={`Open event: ${p.input.name}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.875rem 1rem",
                          background: "var(--color-bg-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          minHeight: 44,
                        }}
                      >
                        <span>
                          <span style={{ fontWeight: 600 }}>{p.input.name}</span>
                          <span
                            style={{
                              color: "var(--color-text-muted)",
                              fontSize: "0.875rem",
                              marginLeft: "0.5rem",
                            }}
                          >
                            {p.input.eventType} · {formatDate(p.input.date)}
                          </span>
                        </span>
                        <span style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
                          {countdownDays(p.input.date)} days
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Wizard view */}
        {view === "wizard" && (
          <div style={{ padding: "2rem 1rem" }}>
            <h1
              ref={resultsHeadingRef}
              tabIndex={-1}
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "1.5rem",
                fontFamily: "var(--font-display)",
                outline: "none",
              }}
            >
              Create Your Event Plan
            </h1>
            <EventWizard onPlanGenerated={handlePlanGenerated} />
          </div>
        )}

        {/* Dashboard view */}
        {view === "dashboard" && activePlan && (
          <>
            <h2
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="sr-only"
              style={{ outline: "none" }}
            >
              Your event plan is ready
            </h2>
            <Dashboard
              plan={activePlan}
              isAiGenerated={isAiGenerated}
              onPlanUpdate={handlePlanUpdate}
            />
          </>
        )}

        {/* Events list view */}
        {view === "events" && (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h1
                style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)" }}
              >
                My Events
              </h1>
              <button
                onClick={handleEraseAll}
                style={{
                  padding: "0.5rem 1rem",
                  background: "none",
                  border: "1px solid var(--color-danger)",
                  color: "var(--color-danger)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  minHeight: 44,
                }}
              >
                🗑 Erase All My Data
              </button>
            </div>

            {savedPlans.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "3rem" }}>
                No saved events yet.{" "}
                <button
                  onClick={() => setView("wizard")}
                  style={{
                    color: "var(--color-accent)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Create your first event plan
                </button>
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {savedPlans.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      padding: "1rem",
                      background: "var(--color-bg-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600 }}>{p.input.name}</p>
                      <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                        {p.input.eventType} · {formatDate(p.input.date)} · {p.input.city} ·{" "}
                        {p.input.guests} guests
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => {
                          setActivePlan(p);
                          setIsAiGenerated(p.isAiGenerated);
                          setView("dashboard");
                        }}
                        aria-label={`Open plan: ${p.input.name}`}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "var(--color-accent)",
                          color: "white",
                          border: "none",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          minHeight: 44,
                        }}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleDeletePlan(p.id)}
                        aria-label={`Delete plan: ${p.input.name}`}
                        style={{
                          padding: "0.5rem 0.75rem",
                          background: "none",
                          border: "1px solid var(--color-danger)",
                          color: "var(--color-danger)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          minHeight: 44,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "2rem 1rem",
          borderTop: "1px solid var(--color-border)",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
          marginTop: "auto",
        }}
        role="contentinfo"
      >
        <p>Jashn — AI Event Planner · Plans stay in your browser · No data sent to our servers</p>
        <p style={{ marginTop: "0.25rem" }}>
          Built for{" "}
          <a
            href="https://hack2skill.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent)" }}
          >
            Hack2skill PromptWars
          </a>
        </p>
      </footer>
    </div>
  );
}

// Styles
const navBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.375rem 0.75rem",
  border: "none",
  borderRadius: "var(--radius)",
  background: active ? "var(--color-accent)" : "transparent",
  color: active ? "white" : "var(--color-text)",
  cursor: "pointer",
  fontSize: "0.875rem",
  fontWeight: active ? 600 : 400,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
});
