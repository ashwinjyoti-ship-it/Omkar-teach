import { useState, useEffect, useRef, useCallback, Component, type ReactNode } from "react";

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
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="border-b border-[#1e1e1e] bg-[#0d0d0d] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-none">
              <span className="text-[#ff6b00]">Akshay</span>{" "}
              <span className="text-white">TODO</span>
            </h1>
            <p className="text-xs text-[#555] mt-1">
              {pending("all")} pending · {doneCount} done
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {installPrompt && (
              <button
                onClick={() => { installPrompt.prompt(); setInstallPrompt(null); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#ff6b00] hover:bg-[#ff8533] text-white font-semibold transition-colors"
              >
                + Home Screen
              </button>
            )}
            {notifSupported && notifPerm !== "granted" && (
              <button
                onClick={() => requestNotifPerm().then(setNotifPerm)}
                className="text-xs px-3 py-1.5 rounded border border-[#2a2a2a] text-[#888] hover:text-[#ff6b00] hover:border-[#ff6b00]/40 transition-colors"
              >
                🔔 Reminders
              </button>
            )}
            {notifPerm === "granted" && (
              <span className="text-xs text-green-500 border border-green-900 px-2 py-1 rounded">🔔 On</span>
            )}
            {doneCount > 0 && (
              <button
                onClick={clearDone}
                className="text-xs text-[#555] hover:text-red-400 transition-colors px-2 py-1 rounded border border-[#222] hover:border-red-900"
              >
                Clear done
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Add task card */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="What needs to be done?"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#ff6b00] transition-colors"
          />

          {/* Deadline */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dueDate}
              min={todayMin}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#888] focus:outline-none focus:border-[#ff6b00] transition-colors [color-scheme:dark]"
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={!dueDate}
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#888] focus:outline-none focus:border-[#ff6b00] transition-colors disabled:opacity-25 [color-scheme:dark]"
            />
            {dueDate && (
              <button
                onClick={() => { setDueDate(""); setDueTime(""); }}
                className="text-[#555] hover:text-red-400 px-2 text-base transition-colors"
              >
                ×
              </button>
            )}
          </div>

          {/* Priority + Add */}
          <div className="flex gap-2">
            {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  priority === p
                    ? `border-[#ff6b00] bg-[#ff6b00]/10 ${P[p].color}`
                    : "border-[#222] text-[#555] hover:border-[#333] hover:text-[#888]"
                }`}
              >
                {P[p].label}
              </button>
            ))}
            <button
              onClick={addTodo}
              disabled={!input.trim()}
              className="px-5 py-1.5 bg-[#ff6b00] hover:bg-[#ff8c33] active:bg-[#e06000] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "critical", "high", "medium", "low"] as FilterPriority[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter === f
                  ? "bg-[#ff6b00] border-[#ff6b00] text-white"
                  : "border-[#222] text-[#555] hover:border-[#444] hover:text-[#888]"
              }`}
            >
              {f === "all" ? "All" : P[f as Priority].label}
              {" "}
              <span className="opacity-70">{pending(f)}</span>
            </button>
          ))}
          <button
            onClick={() => setShowDone((v) => !v)}
            className="ml-auto px-3 py-1 rounded-full text-xs font-medium border border-[#222] text-[#555] hover:border-[#444] hover:text-[#888] transition-all"
          >
            {showDone ? "Hide done" : "Show done"}
          </button>
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {loading && (
            <p className="text-center py-14 text-sm text-[#444]">Loading…</p>
          )}
          {!loading && sorted.length === 0 && (
            <div className="text-center py-16 text-[#333]">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-sm">No tasks here</p>
            </div>
          )}

          {sorted.map((todo) => {
            const overdue = !todo.completed && todo.due_at && todo.due_at < Date.now();
            return (
              <div
                key={todo.id}
                className={`group flex items-start gap-3 bg-[#111] border rounded-xl px-4 py-3 transition-all ${
                  todo.completed
                    ? "border-[#161616] opacity-50"
                    : overdue
                    ? "border-red-900/50 hover:border-red-800/60"
                    : "border-[#1e1e1e] hover:border-[#2a2a2a]"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggle(todo.id)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    todo.completed
                      ? "bg-[#ff6b00] border-[#ff6b00]"
                      : "border-[#444] hover:border-[#ff6b00]"
                  }`}
                >
                  {todo.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Text + meta */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug break-words ${
                    todo.completed ? "line-through text-[#444]" : "text-white"
                  }`}>
                    {todo.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`flex items-center gap-1 text-xs ${P[todo.priority].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${P[todo.priority].dot}`} />
                      {P[todo.priority].label}
                    </span>
                    {todo.due_at && !todo.completed && (
                      <span className={`text-xs font-medium ${dueColor(todo.due_at)}`}>
                        ⏱ {formatDue(todo.due_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => del(todo.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[#333] hover:text-red-500 p-0.5 flex-shrink-0"
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {notifPerm === "granted" && (
          <p className="text-center text-xs text-[#2a2a2a]">
            Reminders: 1 hr · 30 min · 10 min · at deadline
          </p>
        )}
        {todos.length > 0 && (
          <p className="text-center text-xs text-[#2a2a2a] pb-4">
            {todos.length} total tasks · synced to Cloudflare D1
          </p>
        )}
      </main>
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
