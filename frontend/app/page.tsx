"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Energy = "low" | "medium" | "high";
type View = "today" | "goals" | "history";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "active" | "paused" | "completed";
};

type Activity = {
  id: string;
  title: string;
  instructions: string | null;
  planned_minutes: number;
};

type Feedback = {
  completed: boolean;
  difficulty: "easy" | "okay" | "hard" | null;
  notes: string | null;
  ai_analysis: {
    summary?: string;
    encouragement?: string;
    observations?: string[];
    future_adjustments?: string[];
    status?: string;
  };
};

type Session = {
  id: string;
  title: string | null;
  motivation: string;
  requested_minutes: number;
  energy: Energy;
  status: "planned" | "in_progress" | "completed" | "skipped";
  created_at: string;
  activities: Activity[];
  feedback?: Feedback | null;
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const timeOptions = [10, 20, 30, 45];
const energyOptions: Array<{ value: Energy; label: string; detail: string }> = [
  { value: "low", label: "Low", detail: "Keep it gentle" },
  { value: "medium", label: "Steady", detail: "I have some focus" },
  { value: "high", label: "High", detail: "Ready to stretch" },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export default function Home() {
  const [view, setView] = useState<View>("today");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [minutes, setMinutes] = useState(20);
  const [energy, setEnergy] = useState<Energy>("medium");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAction, setRetryAction] = useState<"refresh" | "plan" | null>(
    null,
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [completed, setCompleted] = useState(true);
  const [difficulty, setDifficulty] = useState<"easy" | "okay" | "hard">(
    "okay",
  );
  const [notes, setNotes] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalCategory, setGoalCategory] = useState("reading");

  const refresh = useCallback(async () => {
    try {
      const [nextGoals, nextSessions] = await Promise.all([
        api<Goal[]>("/goals"),
        api<Session[]>("/sessions?limit=20"),
      ]);
      setGoals(nextGoals);
      setSessions(nextSessions);
      setCurrentSession(
        nextSessions.find((session) => session.status === "planned") ?? null,
      );
      setError("");
      setRetryAction(null);
    } catch {
      setError(
        "OFFSCREEN can’t reach the local API yet. Make sure the backend is running on port 3000.",
      );
      setRetryAction("refresh");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [refresh]);

  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status === "completed").length,
    [sessions],
  );

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const goal = await api<Goal>("/goals", {
        method: "POST",
        body: JSON.stringify({
          title: goalTitle,
          description: goalDescription || undefined,
          category: goalCategory,
        }),
      });
      setGoals((current) => [goal, ...current]);
      setGoalTitle("");
      setGoalDescription("");
      setView("today");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save goal.");
    } finally {
      setBusy(false);
    }
  }

  async function planSession() {
    setBusy(true);
    setError("");
    try {
      const session = await api<Session>("/sessions/plan", {
        method: "POST",
        body: JSON.stringify({ minutes, energy }),
      });
      setCurrentSession(session);
      setSessions((current) => [session, ...current]);
      setRetryAction(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create a session.",
      );
      setRetryAction("plan");
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentSession) return;

    setBusy(true);
    setError("");
    try {
      await api(`/sessions/${currentSession.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          completed,
          difficulty,
          notes: notes || undefined,
        }),
      });
      setFeedbackOpen(false);
      setNotes("");
      setCurrentSession(null);
      await refresh();
      setView("history");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save feedback.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("today")}>
          <span className="brand-mark" aria-hidden="true">
            O
          </span>
          <span>OFFSCREEN</span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {(["today", "goals", "history"] as View[]).map((item) => (
            <button
              key={item}
              className={view === item ? "nav-item active" : "nav-item"}
              onClick={() => setView(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="quiet-score" aria-label={`${completedSessions} completed sessions`}>
          <span>{completedSessions}</span>
          <small>sessions</small>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {retryAction && (
            <button
              onClick={() =>
                retryAction === "plan" ? void planSession() : void refresh()
              }
            >
              {retryAction === "plan" ? "Try planning again" : "Try again"}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <section className="loading-state" aria-live="polite">
          <div className="orbit" />
          <p>Finding a quieter rhythm…</p>
        </section>
      ) : (
        <>
          {view === "today" && (
            <section className="today-layout">
              <div className="intro-column">
                <p className="eyebrow">A SMALL POCKET OF TIME</p>
                <h1>
                  Step away.
                  <br />
                  <em>Come back fuller.</em>
                </h1>
                <p className="intro-copy">
                  Tell us what you have right now. Gemma will turn your real
                  goals into one gentle, offline session.
                </p>

                <div className="goal-glimpse">
                  <div>
                    <span className="glimpse-label">IN VIEW</span>
                    <strong>
                      {goals.length
                        ? `${goals.length} active goal${goals.length === 1 ? "" : "s"}`
                        : "No goals yet"}
                    </strong>
                  </div>
                  <button onClick={() => setView("goals")}>
                    {goals.length ? "Review" : "Add your first"} <span>↗</span>
                  </button>
                </div>
              </div>

              <div className="planner-surface">
                {currentSession ? (
                  <SessionCard
                    session={currentSession}
                    onFinish={() => setFeedbackOpen(true)}
                    onReset={() => setCurrentSession(null)}
                  />
                ) : goals.length === 0 ? (
                  <div className="empty-planner">
                    <span className="step-number">01</span>
                    <h2>Begin with something that matters.</h2>
                    <p>
                      Add one personal goal—reading, sketching, stretching,
                      gardening, or anything you want to make room for.
                    </p>
                    <button className="primary-button" onClick={() => setView("goals")}>
                      Add a goal <span>→</span>
                    </button>
                  </div>
                ) : (
                  <div className="planner-form">
                    <div className="surface-heading">
                      <span className="step-number">01</span>
                      <div>
                        <p>PLAN A PAUSE</p>
                        <h2>What do you have today?</h2>
                      </div>
                    </div>

                    <fieldset>
                      <legend>Time available</legend>
                      <div className="time-grid">
                        {timeOptions.map((option) => (
                          <button
                            type="button"
                            key={option}
                            className={minutes === option ? "choice selected" : "choice"}
                            onClick={() => setMinutes(option)}
                          >
                            <strong>{option}</strong>
                            <span>min</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend>Energy right now</legend>
                      <div className="energy-grid">
                        {energyOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={energy === option.value ? "energy selected" : "energy"}
                            onClick={() => setEnergy(option.value)}
                          >
                            <span className={`energy-dot ${option.value}`} />
                            <span>
                              <strong>{option.label}</strong>
                              <small>{option.detail}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <button
                      className="primary-button generate"
                      disabled={busy}
                      onClick={() => void planSession()}
                    >
                      {busy ? "Gemma is shaping your pause…" : "Make my offline plan"}
                      {!busy && <span>→</span>}
                    </button>
                    <p className="privacy-note">No streaks. No guilt. Just the next kind step.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "goals" && (
            <section className="section-layout">
              <div className="section-intro">
                <p className="eyebrow">YOUR COMPASS</p>
                <h1>Make room for what matters.</h1>
                <p>
                  Goals give Gemma useful direction. Keep them personal,
                  concrete, and possible away from a screen.
                </p>
              </div>

              <div className="goals-workspace">
                <form className="goal-form" onSubmit={createGoal}>
                  <p className="form-kicker">ADD A GOAL</p>
                  <label>
                    What would you like to make progress on?
                    <input
                      required
                      maxLength={120}
                      value={goalTitle}
                      onChange={(event) => setGoalTitle(event.target.value)}
                      placeholder="Read the novel on my nightstand"
                    />
                  </label>
                  <label>
                    A little context <span>optional</span>
                    <textarea
                      maxLength={500}
                      value={goalDescription}
                      onChange={(event) => setGoalDescription(event.target.value)}
                      placeholder="Where are you now, and what would feel meaningful?"
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={goalCategory}
                      onChange={(event) => setGoalCategory(event.target.value)}
                    >
                      <option value="reading">Reading</option>
                      <option value="creative">Creative</option>
                      <option value="movement">Movement</option>
                      <option value="learning">Learning</option>
                      <option value="home">Home & garden</option>
                      <option value="wellbeing">Wellbeing</option>
                    </select>
                  </label>
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Saving…" : "Save this goal"} <span>→</span>
                  </button>
                </form>

                <div className="goal-list">
                  <div className="list-heading">
                    <span>ACTIVE GOALS</span>
                    <strong>{goals.length.toString().padStart(2, "0")}</strong>
                  </div>
                  {goals.length ? (
                    goals.map((goal, index) => (
                      <article className="goal-row" key={goal.id}>
                        <span>{(index + 1).toString().padStart(2, "0")}</span>
                        <div>
                          <small>{goal.category}</small>
                          <h3>{goal.title}</h3>
                          {goal.description && <p>{goal.description}</p>}
                        </div>
                        <i aria-hidden="true">↗</i>
                      </article>
                    ))
                  ) : (
                    <p className="empty-list">Your goals will gather here.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {view === "history" && (
            <section className="section-layout history-section">
              <div className="section-intro">
                <p className="eyebrow">A QUIET RECORD</p>
                <h1>Progress without the pressure.</h1>
                <p>
                  A simple record of time spent with the things you care about.
                  No streaks, rankings, or missed-day warnings.
                </p>
              </div>

              <div className="history-list">
                {sessions.length ? (
                  sessions.map((session) => (
                    <article className="history-row" key={session.id}>
                      <time dateTime={session.created_at}>
                        <strong>
                          {new Date(session.created_at).toLocaleDateString("en", {
                            day: "2-digit",
                          })}
                        </strong>
                        <span>
                          {new Date(session.created_at).toLocaleDateString("en", {
                            month: "short",
                          })}
                        </span>
                      </time>
                      <div className="history-copy">
                        <div>
                          <span className={`status ${session.status}`}>{session.status}</span>
                          <span>{session.requested_minutes} min · {session.energy} energy</span>
                        </div>
                        <h3>{session.title || "Offline session"}</h3>
                        <p>{session.motivation}</p>
                        {session.feedback?.ai_analysis.encouragement && (
                          <blockquote>{session.feedback.ai_analysis.encouragement}</blockquote>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-history">
                    <span>○</span>
                    <h2>Your first pause starts today.</h2>
                    <button onClick={() => setView("today")}>Plan a session →</button>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <footer>
        <span>OFFSCREEN · BUILT FOR REAL LIFE</span>
        <span>Powered locally by Gemma</span>
      </footer>

      {feedbackOpen && currentSession && (
        <div className="modal-backdrop" role="presentation">
          <form className="feedback-modal" onSubmit={submitFeedback}>
            <button
              type="button"
              className="modal-close"
              aria-label="Close feedback"
              onClick={() => setFeedbackOpen(false)}
            >
              ×
            </button>
            <p className="form-kicker">CHECK IN, NOT UP</p>
            <h2>How did that feel?</h2>
            <div className="completion-toggle">
              <button
                type="button"
                className={completed ? "selected" : ""}
                onClick={() => setCompleted(true)}
              >
                I did it
              </button>
              <button
                type="button"
                className={!completed ? "selected" : ""}
                onClick={() => setCompleted(false)}
              >
                I skipped it
              </button>
            </div>
            <fieldset>
              <legend>Difficulty</legend>
              <div className="difficulty-grid">
                {(["easy", "okay", "hard"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={difficulty === item ? "selected" : ""}
                    onClick={() => setDifficulty(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Anything you noticed? <span>optional</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="A sentence is plenty."
                maxLength={2000}
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? "Saving reflection…" : "Save reflection"} <span>→</span>
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function SessionCard({
  session,
  onFinish,
  onReset,
}: {
  session: Session;
  onFinish: () => void;
  onReset: () => void;
}) {
  return (
    <div className="session-card">
      <div className="session-meta">
        <span>YOUR OFFLINE PLAN</span>
        <span>{session.requested_minutes} MIN · {session.energy.toUpperCase()}</span>
      </div>
      <h2>{session.title}</h2>
      <p className="motivation">“{session.motivation}”</p>
      <div className="activity-list">
        {session.activities.map((activity, index) => (
          <article key={activity.id}>
            <span>{(index + 1).toString().padStart(2, "0")}</span>
            <div>
              <div>
                <h3>{activity.title}</h3>
                <strong>{activity.planned_minutes} min</strong>
              </div>
              <p>{activity.instructions}</p>
            </div>
          </article>
        ))}
      </div>
      <button className="primary-button generate" onClick={onFinish}>
        I’m back — check in <span>→</span>
      </button>
      <button className="text-button" onClick={onReset}>Plan something different</button>
    </div>
  );
}
