import { useState, useEffect, useRef, useCallback, Component, type ReactNode } from "react";

// ── Calendar / DatePicker / TimePicker ───────────────────────────────────────
const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  const h = Math.floor(mins / 60), m = mins % 60;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const label = `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

function CalendarPopover({ value, min, onChange, onClose }: {
  value: string; min?: string;
  onChange: (v: string) => void; onClose: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const init = value ? new Date(value + "T00:00") : new Date();
  const [view, setView] = useState(() => new Date(init.getFullYear(), init.getMonth(), 1));
  const yr = view.getFullYear(), mo = view.getMonth();
  const firstDow = new Date(yr, mo, 1).getDay();
  const dim = new Date(yr, mo + 1, 0).getDate();
  const cells = Math.ceil((firstDow + dim) / 7) * 7;

  function toStr(d: number) {
    return `${yr}-${String(mo + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }

  return (
    <div className="cal-popover" onMouseDown={(e) => e.stopPropagation()}>
      <div className="cal-nav">
        <button type="button" onClick={() => setView(new Date(yr, mo - 1, 1))}>‹</button>
        <span>{CAL_MONTHS[mo]} {yr}</span>
        <button type="button" onClick={() => setView(new Date(yr, mo + 1, 1))}>›</button>
      </div>
      <div className="cal-grid">
        {CAL_DAYS.map(d => <span key={d} className="cal-dow">{d}</span>)}
        {Array.from({ length: cells }, (_, i) => {
          const day = i - firstDow + 1;
          if (day < 1 || day > dim) return <span key={i} className="cal-empty" />;
          const s = toStr(day);
          const past = !!min && s < min;
          return (
            <button key={i} type="button" disabled={past} onClick={() => { onChange(s); onClose(); }}
              className={`cal-day${s === value ? " cal-sel" : ""}${s === todayStr && s !== value ? " cal-today" : ""}${past ? " cal-past" : ""}`}>
              {day}
            </button>
          );
        })}
      </div>
      {value && <button type="button" className="cal-clear" onClick={() => { onChange(""); onClose(); }}>Clear date</button>}
    </div>
  );
}

function DatePickerField({ label, value, min, onChange }: {
  label: string; value: string; min?: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const display = value
    ? new Date(value + "T00:00").toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" })
    : null;

  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <div ref={wrapRef} className="dp-wrap">
        <button type="button" className={`dp-btn${value ? " dp-has-val" : ""}`} onClick={() => setOpen(v => !v)}>
          <svg className="dp-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="16" height="14" rx="2"/>
            <path d="M2 8h16M7 2v4M13 2v4"/>
          </svg>
          <span className="dp-text">{display ?? "Pick a date"}</span>
          {value && <span className="dp-x" role="button" aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(""); }}>×</span>}
        </button>
        {open && <CalendarPopover value={value} min={min} onChange={onChange} onClose={() => setOpen(false)} />}
      </div>
    </label>
  );
}

function TimePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const display = value ? (() => {
    const [h, m] = value.split(":").map(Number);
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  })() : null;

  return (
    <label className="field-group">
      <span className="field-label">Time <span className="field-label-hint">(optional)</span></span>
      <div ref={wrapRef} className="dp-wrap">
        <button type="button" className={`dp-btn${value ? " dp-has-val" : ""}`} onClick={() => setOpen(v => !v)}>
          <svg className="dp-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8"/>
            <path d="M10 6v4l2.5 2.5"/>
          </svg>
          <span className="dp-text">{display ?? "Pick a time"}</span>
          {value && <span className="dp-x" role="button" aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(""); }}>×</span>}
        </button>
        {open && (
          <div className="tp-popover" onMouseDown={(e) => e.stopPropagation()}>
            <div className="tp-grid">
              {TIME_SLOTS.map(slot => (
                <button key={slot.value} type="button"
                  className={`tp-slot${slot.value === value ? " tp-sel" : ""}`}
                  onClick={() => { onChange(slot.value); setOpen(false); }}>
                  {slot.label}
                </button>
              ))}
            </div>
            {value && <button type="button" className="cal-clear" onClick={() => { onChange(""); setOpen(false); }}>Clear time</button>}
          </div>
        )}
      </div>
    </label>
  );
}

// ── Error boundary so a crash shows a message instead of blank white ──────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
          <div className="text-center space-y-3">
            <p className="text-[#ff6b00] text-4xl">!</p>
            <p className="text-white font-semibold">Something went wrong</p>
            <p className="text-[#666] text-sm">{this.state.error}</p>
            <button onClick={() => location.reload()} className="text-xs px-4 py-2 bg-[#ff6b00] text-white rounded-lg mt-2">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Safe Notification helpers ─────────────────────────────────────────────────
const notifSupported = typeof window !== "undefined" && "Notification" in window;
function getNotifPerm(): NotificationPermission {
  return notifSupported ? Notification.permission : "denied";
}
async function requestNotifPerm(): Promise<NotificationPermission> {
  if (!notifSupported) return "denied";
  return Notification.requestPermission();
}
function fireNotif(title: string, body: string, tag: string) {
  if (!notifSupported || Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag }); } catch { /* ignore */ }
}

// ── Types & constants ─────────────────────────────────────────────────────────
type Priority = "critical" | "high" | "medium" | "low";
type FilterPriority = Priority | "all";

interface Todo {
  id: string;
  text: string;
  priority: Priority;
  completed: boolean;
  due_at: number | null;
  created_at: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const P = {
  critical: { label: "Critical", color: "text-red-400",    dot: "bg-red-500",    order: 0 },
  high:     { label: "High",     color: "text-orange-400", dot: "bg-orange-500", order: 1 },
  medium:   { label: "Medium",   color: "text-yellow-400", dot: "bg-yellow-500", order: 2 },
  low:      { label: "Low",      color: "text-green-400",  dot: "bg-green-500",  order: 3 },
} satisfies Record<Priority, { label: string; color: string; dot: string; order: number }>;

const THRESHOLDS = [60, 30, 10, 0];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatDue(ms: number) {
  const diff = ms - Date.now();
  if (diff < 0) return "Overdue";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return "Due now";
}

function dueColor(ms: number) {
  const diff = ms - Date.now();
  if (diff < 0) return "text-red-400";
  if (diff < 10 * 60000) return "text-red-400";
  if (diff < 30 * 60000) return "text-orange-400";
  if (diff < 60 * 60000) return "text-yellow-400";
  return "text-zinc-500";
}

// ── Main component ────────────────────────────────────────────────────────────
function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [showDone, setShowDone] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(getNotifPerm);
  const [tick, setTick] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    // Load todos
    fetch("/api/todos")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTodos(data as Todo[]))
      .catch(() => setTodos([]))
      .finally(() => setLoading(false));

    // Reminder tick
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);

    // PWA install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const checkReminders = useCallback(() => {
    if (!notifSupported || Notification.permission !== "granted") return;
    const now = Date.now();
    todos.filter((t) => !t.completed && t.due_at).forEach((t) => {
      THRESHOLDS.forEach((mins) => {
        const key = `${t.id}-${mins}`;
        if (notified.current.has(key)) return;
        const diff = (t.due_at! - now) / 60000;
        if (diff <= mins && diff > mins - 1) {
          notified.current.add(key);
          const msg = mins === 0 ? "due NOW" : `due in ${mins === 60 ? "1 hour" : `${mins} min`}`;
          fireNotif("⏰ Akshay TODO", `"${t.text}" is ${msg}`, key);
        }
      });
    });
  }, [todos]);

  useEffect(() => { checkReminders(); }, [tick, checkReminders]);

  async function addTodo() {
    const text = input.trim();
    if (!text) return;
    const due_at = dueDate ? new Date(`${dueDate}T${dueTime || "23:59"}`).getTime() : null;
    const todo: Todo = { id: uid(), text, priority, completed: false, due_at, created_at: Date.now() };
    setTodos((p) => [todo, ...p]);
    setInput(""); setDueDate(""); setDueTime("");
    inputRef.current?.focus();
    fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todo),
    }).catch(() => {});
  }

  function toggle(id: string) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    setTodos((p) => p.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
    fetch(`/api/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    }).catch(() => {});
  }

  function del(id: string) {
    setTodos((p) => p.filter((t) => t.id !== id));
    fetch(`/api/todos/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function clearDone() {
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    setTodos((p) => p.filter((t) => !t.completed));
    ids.forEach((id) => fetch(`/api/todos/${id}`, { method: "DELETE" }).catch(() => {}));
  }

  const pending = (f: FilterPriority) =>
    f === "all"
      ? todos.filter((t) => !t.completed).length
      : todos.filter((t) => t.priority === f && !t.completed).length;

  const sorted = todos
    .filter((t) => filter === "all" || t.priority === filter)
    .filter((t) => showDone || !t.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.due_at && !b.due_at) return -1;
      if (!a.due_at && b.due_at) return 1;
      if (a.due_at && b.due_at && a.due_at !== b.due_at) return a.due_at - b.due_at;
      return P[a.priority].order - P[b.priority].order || b.created_at - a.created_at;
    });

  const doneCount = todos.filter((t) => t.completed).length;
  const todayMin = new Date().toISOString().slice(0, 10);

  return (
    <div className="todo-page">
      <div className="todo-shell">
        <header className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Personal task manager</p>
            <h1>
              <span>Akshay</span> TODO
            </h1>
            <p className="hero-text">
              Prioritize tasks, set deadlines, and keep today's work moving.
            </p>
          </div>

          <div className="hero-actions">
            <div className="stats-pill">
              <strong>{pending("all")}</strong>
              <span>pending</span>
            </div>
            <div className="stats-pill done">
              <strong>{doneCount}</strong>
              <span>done</span>
            </div>
            {installPrompt && (
              <button
                onClick={() => { installPrompt.prompt(); setInstallPrompt(null); }}
                className="secondary-action highlight"
              >
                + Home Screen
              </button>
            )}
            {notifSupported && notifPerm !== "granted" && (
              <button
                onClick={() => requestNotifPerm().then(setNotifPerm)}
                className="secondary-action"
              >
                Reminders
              </button>
            )}
            {notifPerm === "granted" && (
              <span className="status-badge">Reminders on</span>
            )}
            {doneCount > 0 && (
              <button
                onClick={clearDone}
                className="secondary-action danger"
              >
                Clear done
              </button>
            )}
          </div>
        </header>

        <main className="todo-panel">
          <section className="input-card" aria-label="Add a task">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="What needs to be done?"
            className="task-input"
          />

          <div className="schedule-row">
            <DatePickerField
              label="Due date"
              value={dueDate}
              min={todayMin}
              onChange={(v) => { setDueDate(v); if (!v) setDueTime(""); }}
            />
            <TimePickerField
              value={dueTime}
              onChange={(v) => { setDueTime(v); if (v && !dueDate) setDueDate(todayMin); }}
            />
          </div>

          <div className="priority-row">
            {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`priority-button ${priority === p ? "selected" : ""}`}
              >
                {P[p].label}
              </button>
            ))}
            <button
              onClick={addTodo}
              disabled={!input.trim()}
              className="add-button"
            >
              Add
            </button>
          </div>
          </section>

          <section className="filters" aria-label="Task filters">
          {(["all", "critical", "high", "medium", "low"] as FilterPriority[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-chip ${filter === f ? "active" : ""}`}
            >
              {f === "all" ? "All" : P[f as Priority].label}
              {" "}
              <span>{pending(f)}</span>
            </button>
          ))}
          <button
            onClick={() => setShowDone((v) => !v)}
            className="filter-chip toggle-done"
          >
            {showDone ? "Hide done" : "Show done"}
          </button>
          </section>

          <section className="task-list" aria-label="Tasks">
          {loading && (
            <p className="empty-state">Loading...</p>
          )}
          {!loading && sorted.length === 0 && (
            <div className="empty-state">
              <p className="empty-check">✓</p>
              <p>No tasks here</p>
              <span>Add your first task above to get started.</span>
            </div>
          )}

          {sorted.map((todo) => {
            const overdue = !todo.completed && todo.due_at && todo.due_at < Date.now();
            return (
              <div
                key={todo.id}
                className={`task-card ${todo.completed ? "completed" : ""} ${overdue ? "overdue" : ""}`}
              >
                <button
                  onClick={() => toggle(todo.id)}
                  className={`check-button ${todo.completed ? "checked" : ""}`}
                  aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {todo.completed && (
                    <svg className="check-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="task-content">
                  <p className="task-title">
                    {todo.text}
                  </p>
                  <div className="task-meta">
                    <span className="priority-label">
                      <span className={`priority-dot ${todo.priority}`} />
                      {P[todo.priority].label}
                    </span>
                    {todo.due_at && !todo.completed && (
                      <span className={`due-label ${dueColor(todo.due_at).replace("text-", "")}`}>
                        {formatDue(todo.due_at)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => del(todo.id)}
                  className="delete-button"
                  aria-label="Delete"
                >
                  <svg className="delete-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
          </section>

          <footer className="app-footer">
            {notifPerm === "granted" && (
              <span>Reminders: 1 hr, 30 min, 10 min, at deadline</span>
            )}
            {todos.length > 0 && (
              <span>{todos.length} total tasks synced to Cloudflare D1</span>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TodoApp />
    </ErrorBoundary>
  );
}
