"use client";

import { useState, useCallback, useRef } from "react";
import {
  EventInputSchema,
  EVENT_TYPES,
  CURRENCIES,
  type PLAN_LANGUAGES,
  type Plan,
} from "@/lib/validation";

// ===== Step definitions =====
const TOTAL_STEPS = 5;

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepErrors {
  [field: string]: string;
}

interface WizardProps {
  onPlanGenerated: (plan: Plan, isAiGenerated: boolean) => void;
}

// ===== Helper: get tomorrow's date string =====
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ===== Field components =====
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm mt-1" style={{ color: "var(--color-danger)" }}>
      {message}
    </p>
  );
}

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium mb-1"
      style={{ color: "var(--color-text)" }}
    >
      {children}
      {required && (
        <span aria-hidden="true" style={{ color: "var(--color-danger)" }}>
          {" "}
          *
        </span>
      )}
      {required && <span className="sr-only"> (required)</span>}
    </label>
  );
}

// Wide form state — holds all possible fields across all event types before discriminated union parse
type FormData = Partial<{
  eventType: string;
  name: string;
  date: string;
  city: string;
  guests: number;
  totalBudget: number;
  currency: string;
  theme: string;
  dietaryPreferences: string;
  culturalTraditions: string;
  isIndoor: boolean;
  notes: string;
  planLanguage: string;
  // wedding
  ceremonies: string;
  traditions: string;
  // birthday
  age: number;
  isMilestone: boolean;
  isKidsParty: boolean;
  // community
  purpose: string;
  isPublic: boolean;
  isTicketed: boolean;
  volunteersNeeded: number;
  permitsRequired: boolean;
}>;

// ===== Main Wizard =====
export function EventWizard({ onPlanGenerated }: WizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<StepErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [formData, setFormData] = useState<FormData>({
    eventType: "wedding",
    currency: "INR",
    planLanguage: "en",
    isIndoor: true,
    guests: 100,
    theme: "",
    dietaryPreferences: "",
    culturalTraditions: "",
    notes: "",
    // wedding defaults
    ceremonies: "",
    traditions: "",
    // birthday defaults
    isMilestone: false,
    isKidsParty: false,
    // community defaults
    isPublic: true,
    isTicketed: false,
    volunteersNeeded: 0,
    permitsRequired: false,
  });

  const update = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const focusHeading = () => {
    setTimeout(() => headingRef.current?.focus(), 50);
  };

  const validateStep = (currentStep: WizardStep): StepErrors => {
    const errs: StepErrors = {};
    if (currentStep === 1) {
      if (!formData.eventType) errs["eventType"] = "Please select an event type.";
    }
    if (currentStep === 2) {
      if (!formData.name?.trim()) errs["name"] = "Event name is required.";
      if (!formData.date) {
        errs["date"] = "Event date is required.";
      } else if (new Date(formData.date) <= new Date()) {
        errs["date"] = "Event date must be in the future.";
      }
      if (!formData.city?.trim()) errs["city"] = "City is required.";
      if (!formData.guests || formData.guests < 1 || formData.guests > 5000) {
        errs["guests"] = "Guests must be between 1 and 5,000.";
      }
      if (!formData.totalBudget || formData.totalBudget < 100) {
        errs["totalBudget"] = "Budget must be at least 100.";
      }
    }
    if (currentStep === 5) {
      if (!privacyAcknowledged) errs["privacy"] = "Please acknowledge the privacy notice.";
    }
    return errs;
  };

  const nextStep = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTimeout(() => errorSummaryRef.current?.focus(), 50);
      return;
    }
    setErrors({});
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as WizardStep);
      focusHeading();
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep);
      focusHeading();
    }
  };

  const handleSubmit = async () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTimeout(() => errorSummaryRef.current?.focus(), 50);
      return;
    }

    const parsed = EventInputSchema.safeParse(formData);
    if (!parsed.success) {
      setErrors({ form: "Please check all fields and try again." });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: parsed.data }),
      });
      const data: unknown = await res.json();
      if (res.ok && data && typeof data === "object" && "plan" in data) {
        const d = data as { plan: Plan; isAiGenerated: boolean };
        onPlanGenerated(d.plan, d.isAiGenerated);
      } else {
        setErrors({ form: "Failed to generate plan. Please try again." });
      }
    } catch {
      setErrors({ form: "Network error. Please check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = ["Event Type", "Basic Details", "Event-Specific", "Preferences", "Review"];

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "1.5rem",
        background: "var(--color-bg-card)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Progress indicator */}
      <nav aria-label="Wizard steps" style={{ marginBottom: "2rem" }}>
        <ol style={{ display: "flex", gap: "0.25rem", listStyle: "none", padding: 0 }}>
          {stepLabels.map((label, i) => {
            const num = (i + 1) as WizardStep;
            const isCurrent = num === step;
            const isComplete = num < step;
            return (
              <li key={num} style={{ flex: 1, textAlign: "center" }}>
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      background: isComplete
                        ? "var(--color-success)"
                        : isCurrent
                          ? "var(--color-accent)"
                          : "var(--color-bg-subtle)",
                      color: isComplete || isCurrent ? "white" : "var(--color-text-muted)",
                    }}
                  >
                    {isComplete ? "✓" : num}
                  </div>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: isCurrent ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                    className="hidden sm:block"
                  >
                    {label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
        <progress
          value={step}
          max={TOTAL_STEPS}
          aria-label={`Step ${step} of ${TOTAL_STEPS}: ${stepLabels[step - 1]}`}
          style={{ width: "100%", marginTop: "0.5rem", height: 4 }}
        />
      </nav>

      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-label="Form errors"
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fef2f2",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius)",
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--color-danger)", marginBottom: "0.5rem" }}>
            Please fix the following errors:
          </p>
          <ul style={{ paddingLeft: "1.25rem", color: "var(--color-danger)" }}>
            {Object.values(errors).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step heading */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: "1.5rem",
          fontFamily: "var(--font-display)",
          color: "var(--color-text)",
        }}
      >
        {step === 1 && "What type of event are you planning?"}
        {step === 2 && "Basic Details"}
        {step === 3 && "Event-Specific Information"}
        {step === 4 && "Preferences & Customisation"}
        {step === 5 && "Review & Generate Plan"}
      </h2>

      {/* Step 1: Event Type */}
      {step === 1 && (
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="sr-only">Event type</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {EVENT_TYPES.map((type) => {
              const icons = { wedding: "💍", birthday: "🎂", community: "🎪" };
              const labels = {
                wedding: "Wedding",
                birthday: "Birthday",
                community: "Community Event",
              };
              const descs = {
                wedding: "Plan your dream wedding with budget, vendors & timeline",
                birthday: "Celebrate a special birthday with personalised ideas",
                community: "Organise a festival, fair, or community gathering",
              };
              return (
                <label
                  key={type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "1rem",
                    border: `2px solid ${formData.eventType === type ? "var(--color-accent)" : "var(--color-border)"}`,
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    background:
                      formData.eventType === type
                        ? "var(--color-bg-subtle)"
                        : "var(--color-bg-card)",
                    transition: "border-color 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="eventType"
                    value={type}
                    checked={formData.eventType === type}
                    onChange={() => update("eventType", type)}
                    aria-describedby={`desc-${type}`}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  <span style={{ fontSize: "1.5rem" }} aria-hidden="true">
                    {icons[type]}
                  </span>
                  <span>
                    <span style={{ display: "block", fontWeight: 600 }}>{labels[type]}</span>
                    <span
                      id={`desc-${type}`}
                      style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
                    >
                      {descs[type]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Step 2: Basic Details */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <Label htmlFor="eventName" required>
              Event Name
            </Label>
            <input
              id="eventName"
              type="text"
              value={formData.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
              maxLength={100}
              placeholder="e.g. Priya & Arjun's Wedding"
              aria-invalid={!!errors["name"]}
              aria-describedby={errors["name"] ? "err-name" : undefined}
              style={inputStyle(!!errors["name"])}
            />
            <FieldError id="err-name" message={errors["name"]} />
          </div>

          <div>
            <Label htmlFor="eventDate" required>
              Event Date
            </Label>
            <input
              id="eventDate"
              type="date"
              value={formData.date ?? ""}
              min={tomorrowStr()}
              onChange={(e) => update("date", e.target.value)}
              aria-invalid={!!errors["date"]}
              aria-describedby={errors["date"] ? "err-date" : undefined}
              style={inputStyle(!!errors["date"])}
            />
            <FieldError id="err-date" message={errors["date"]} />
          </div>

          <div>
            <Label htmlFor="eventCity" required>
              City
            </Label>
            <input
              id="eventCity"
              type="text"
              value={formData.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
              maxLength={100}
              placeholder="e.g. Mumbai"
              aria-invalid={!!errors["city"]}
              aria-describedby={errors["city"] ? "err-city" : undefined}
              style={inputStyle(!!errors["city"])}
            />
            <FieldError id="err-city" message={errors["city"]} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <Label htmlFor="guests" required>
                Number of Guests
              </Label>
              <input
                id="guests"
                type="number"
                min={1}
                max={5000}
                value={formData.guests ?? ""}
                onChange={(e) => update("guests", Number(e.target.value))}
                aria-invalid={!!errors["guests"]}
                aria-describedby={errors["guests"] ? "err-guests" : "guests-hint"}
                style={inputStyle(!!errors["guests"])}
              />
              <p id="guests-hint" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                1 – 5,000
              </p>
              <FieldError id="err-guests" message={errors["guests"]} />
            </div>

            <div>
              <Label htmlFor="currency" required>
                Currency
              </Label>
              <select
                id="currency"
                value={formData.currency ?? "INR"}
                onChange={(e) => update("currency", e.target.value as (typeof CURRENCIES)[number])}
                style={inputStyle(false)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="totalBudget" required>
              Total Budget ({formData.currency ?? "INR"})
            </Label>
            <input
              id="totalBudget"
              type="number"
              min={100}
              max={1_000_000_000}
              value={formData.totalBudget ?? ""}
              onChange={(e) => update("totalBudget", Number(e.target.value))}
              placeholder="e.g. 500000"
              aria-invalid={!!errors["totalBudget"]}
              aria-describedby={errors["totalBudget"] ? "err-budget" : "budget-hint"}
              style={inputStyle(!!errors["totalBudget"])}
            />
            <p id="budget-hint" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Enter your total available budget
            </p>
            <FieldError id="err-budget" message={errors["totalBudget"]} />
          </div>
        </div>
      )}

      {/* Step 3: Type-specific fields */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {formData.eventType === "wedding" && (
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend
                style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-text)" }}
              >
                Wedding Details
              </legend>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <Label htmlFor="ceremonies">Ceremonies & Functions</Label>
                  <textarea
                    id="ceremonies"
                    value={formData.ceremonies ?? ""}
                    onChange={(e) => update("ceremonies", e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="e.g. Engagement, Mehendi, Sangeet, Wedding Ceremony, Reception"
                    aria-describedby="ceremonies-hint"
                    style={{ ...inputStyle(false), resize: "vertical" }}
                  />
                  <p
                    id="ceremonies-hint"
                    style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}
                  >
                    List the ceremonies/functions you want to plan
                  </p>
                </div>
                <div>
                  <Label htmlFor="traditions">Traditions & Customs (optional)</Label>
                  <textarea
                    id="traditions"
                    value={formData.traditions ?? ""}
                    onChange={(e) => update("traditions", e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Describe any traditions you'd like incorporated..."
                    style={{ ...inputStyle(false), resize: "vertical" }}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {formData.eventType === "birthday" && (
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend
                style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-text)" }}
              >
                Birthday Details
              </legend>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <Label htmlFor="age">Age / Milestone (optional)</Label>
                  <input
                    id="age"
                    type="number"
                    min={0}
                    max={150}
                    value={formData.age ?? ""}
                    onChange={(e) =>
                      update("age", e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="e.g. 30"
                    style={inputStyle(false)}
                  />
                </div>
                <div style={{ display: "flex", gap: "2rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isMilestone ?? false}
                      onChange={(e) => update("isMilestone", e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                    <span>Milestone birthday</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isKidsParty ?? false}
                      onChange={(e) => update("isKidsParty", e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                    <span>Children&apos;s party</span>
                  </label>
                </div>
              </div>
            </fieldset>
          )}

          {formData.eventType === "community" && (
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend
                style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--color-text)" }}
              >
                Community Event Details
              </legend>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <Label htmlFor="purpose">Event Purpose / Description</Label>
                  <textarea
                    id="purpose"
                    value={formData.purpose ?? ""}
                    onChange={(e) => update("purpose", e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="e.g. Annual neighbourhood cultural festival celebrating diversity"
                    style={{ ...inputStyle(false), resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isPublic ?? true}
                      onChange={(e) => update("isPublic", e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                    <span>Public event</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isTicketed ?? false}
                      onChange={(e) => update("isTicketed", e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                    <span>Ticketed event</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.permitsRequired ?? false}
                      onChange={(e) => update("permitsRequired", e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }}
                    />
                    <span>Permits required</span>
                  </label>
                </div>
                <div>
                  <Label htmlFor="volunteers">Volunteers Needed</Label>
                  <input
                    id="volunteers"
                    type="number"
                    min={0}
                    max={10000}
                    value={formData.volunteersNeeded ?? 0}
                    onChange={(e) => update("volunteersNeeded", Number(e.target.value))}
                    style={inputStyle(false)}
                  />
                </div>
              </div>
            </fieldset>
          )}
        </div>
      )}

      {/* Step 4: Preferences */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <Label htmlFor="theme">Theme / Vibe</Label>
            <input
              id="theme"
              type="text"
              value={formData.theme ?? ""}
              onChange={(e) => update("theme", e.target.value)}
              maxLength={500}
              placeholder="e.g. Rustic garden, Bollywood glam, Minimalist modern"
              style={inputStyle(false)}
            />
          </div>

          <div>
            <Label htmlFor="dietary">Dietary Preferences</Label>
            <textarea
              id="dietary"
              value={formData.dietaryPreferences ?? ""}
              onChange={(e) => update("dietaryPreferences", e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. Vegetarian, Jain, Gluten-free, Halal, Vegan, Nut-free"
              aria-describedby="dietary-hint"
              style={{ ...inputStyle(false), resize: "vertical" }}
            />
            <p id="dietary-hint" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Your dietary needs will be reflected in menu suggestions
            </p>
          </div>

          <div>
            <Label htmlFor="cultural">Cultural / Tradition Preferences</Label>
            <textarea
              id="cultural"
              value={formData.culturalTraditions ?? ""}
              onChange={(e) => update("culturalTraditions", e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Describe any cultural customs or traditions you'd like included (optional)"
              style={{ ...inputStyle(false), resize: "vertical" }}
            />
          </div>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Venue Setting</legend>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name="venueType"
                  value="indoor"
                  checked={formData.isIndoor === true}
                  onChange={() => update("isIndoor", true)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span>🏛️ Indoor</span>
              </label>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name="venueType"
                  value="outdoor"
                  checked={formData.isIndoor === false}
                  onChange={() => update("isIndoor", false)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span>🌿 Outdoor</span>
              </label>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="planLanguage">Plan Language</Label>
            <select
              id="planLanguage"
              value={formData.planLanguage ?? "en"}
              onChange={(e) =>
                update("planLanguage", e.target.value as (typeof PLAN_LANGUAGES)[number])
              }
              style={inputStyle(false)}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <textarea
              id="notes"
              value={formData.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Any other details, special requirements, or considerations..."
              style={{ ...inputStyle(false), resize: "vertical" }}
            />
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div
            style={{
              padding: "1rem",
              background: "var(--color-bg-subtle)",
              borderRadius: "var(--radius)",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Event Summary</h3>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 1rem" }}>
              {[
                ["Type", formData.eventType],
                ["Name", formData.name],
                ["Date", formData.date],
                ["City", formData.city],
                ["Guests", formData.guests],
                ["Budget", `${formData.totalBudget} ${formData.currency}`],
                ["Language", formData.planLanguage],
              ].map(([key, val]) =>
                val
                  ? [
                      <dt
                        key={`dt-${key}`}
                        style={{
                          fontWeight: 500,
                          color: "var(--color-text-muted)",
                          fontSize: "0.875rem",
                        }}
                      >
                        {key}
                      </dt>,
                      <dd key={`dd-${key}`} style={{ fontSize: "0.875rem" }}>
                        {String(val)}
                      </dd>,
                    ]
                  : null,
              )}
            </dl>
          </div>

          {/* Privacy Notice */}
          <div
            role="note"
            style={{
              padding: "1rem",
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: "var(--radius)",
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>🔒 Privacy Notice</p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
              Your event details will be processed securely using the <strong>Groq AI API</strong>{" "}
              to generate a personalised plan. <strong>Nothing is stored on our servers</strong> —
              your plan lives only in your browser. Do not include sensitive personal or financial
              information.
            </p>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={privacyAcknowledged}
              onChange={(e) => {
                setPrivacyAcknowledged(e.target.checked);
                if (e.target.checked) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next["privacy"];
                    return next;
                  });
                }
              }}
              aria-invalid={!!errors["privacy"]}
              aria-describedby={errors["privacy"] ? "err-privacy" : undefined}
              style={{ marginTop: 2, accentColor: "var(--color-accent)" }}
            />
            <span>
              I understand my event details will be processed by the Groq AI API and I accept the
              privacy terms above.
            </span>
          </label>
          <FieldError id="err-privacy" message={errors["privacy"]} />
        </div>
      )}

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "2rem",
          gap: "1rem",
        }}
      >
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 1}
          aria-disabled={step === 1}
          style={{
            ...btnStyle,
            background: "var(--color-bg-subtle)",
            color: "var(--color-text)",
            opacity: step === 1 ? 0.5 : 1,
          }}
        >
          ← Back
        </button>

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={nextStep}
            style={{ ...btnStyle, background: "var(--color-accent)", color: "white" }}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading}
            aria-disabled={isLoading}
            aria-live="polite"
            style={{
              ...btnStyle,
              background: "var(--color-accent)",
              color: "white",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <>
                <span aria-hidden="true">⏳</span> Generating Plan...
              </>
            ) : (
              <>✨ Generate My Plan</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ===== Shared styles =====
const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "0.625rem 0.75rem",
  border: `1px solid ${hasError ? "var(--color-danger)" : "var(--color-border)"}`,
  borderRadius: "var(--radius)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: "1rem",
  outline: "none",
});

const btnStyle: React.CSSProperties = {
  padding: "0.625rem 1.5rem",
  borderRadius: "var(--radius)",
  border: "none",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};
