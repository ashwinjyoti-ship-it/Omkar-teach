import { useState, useEffect, useRef, useCallback } from "react";

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

const P = {
  critical: { label: "Critical", pill: "bg-red-500/15 text-red-400 border-red-500/30",  dot: "bg-red-500",    active: "bg-red-500",    order: 0 },
  high:     { label: "High",     pill: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-500", active: "bg-orange-500", order: 1 },
  medium:   { label: "Medium",   pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-500", active: "bg-yellow-500", order: 2 },
  low:      { label: "Low",      pill: "bg-green-500/15 text-green-400 border-green-500/30",  dot: "bg-green-500",  active: "bg-green-600",  order: 3 },
} satisfies Record<Priority, { label: string; pill: string; dot: string; active: string; order: number }>;

const THRESHOLDS = [60, 30, 10, 0]; // minutes before deadline

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatDue(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return "Overdue";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return "Due now";
}

function dueChipColor(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return "text-red-400 bg-red-500/10 border-red-500/30";
  if (diff < 10 * 60000) return "text-red-400 bg-red-500/10 border-red-500/30";
  if (diff < 30 * 60000) return "text-orange-400 bg-orange-500/10 border-orange-500/30";
  if (diff < 60 * 60000) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  return "text-zinc-400 bg-zinc-800/50 border-zinc-700/50";
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [showDone, setShowDone] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [tick, setTick] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    fetchTodos();
    setNotifPerm(Notification.permission);
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);

    // PWA install prompt
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => { clearInterval(interval); window.removeEventListener("beforeinstallprompt", handler); };
  }, []);

  async function fetchTodos() {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) setTodos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const checkReminders = useCallback(() => {
    if (Notification.permission !== "granted") return;
    const now = Date.now();
    todos.filter((t) => !t.completed && t.due_at).forEach((t) => {
      THRESHOLDS.forEach((mins) => {
        const key = `${t.id}-${mins}`;
        if (notified.current.has(key)) return;
        const diff = (t.due_at! - now) / 60000;
        if (diff <= mins && diff > mins - 1) {
          notified.current.add(key);
          const msg = mins === 0 ? "is due NOW" : `is due in ${mins} minutes`;
          new Notification("⏰ Akshay TODO", { body: `"${t.text}" ${msg}`, tag: key });
        }
      });
    });
  }, [todos]);

  useEffect(() => { checkReminders(); }, [tick, checkReminders]);

  async function requestNotif() {
    setNotifPerm(await Notification.requestPermission());
  }

  async function installPWA() {
    if (!installPrompt) return;
    (installPrompt as BeforeInstallPromptEvent).prompt();
    setInstallPrompt(null);
  }

  async function addTodo() {
    const text = input.trim();
    if (!text) return;
    const due_at = dueDate
      ? new Date(`${dueDate}T${dueTime || "23:59"}`).getTime()
      : null;
    const todo: Todo = { id: uid(), text, priority, completed: false, due_at, created_at: Date.now() };
    setTodos((p) => [todo, ...p]);
    setInput(""); setDueDate(""); setDueTime("");
    inputRef.current?.focus();
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todo),
    });
  }

  async function toggle(id: string) {
    const todo = todos.find((t) => t.id === id)!;
    setTodos((p) => p.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
    await fetch(`/api/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });
  }

  async function del(id: string) {
    setTodos((p) => p.filter((t) => t.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function clearDone() {
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    setTodos((p) => p.filter((t) => !t.completed));
    await Promise.all(ids.map((id) => fetch(`/api/todos/${id}`, { method: "DELETE" })));
  }

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

  const pending = (f: FilterPriority) =>
    f === "all"
      ? todos.filter((t) => !t.completed).length
      : todos.filter((t) => t.priority === f && !t.completed).length;

  const doneCount = todos.filter((t) => t.completed).length;
  const todayMin = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center">
      {/* Header */}
      <header className="w-full border-b border-white/5 bg-[#0d0d0d] sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none">
              <span className="text-[#ff6b00]">Akshay</span>{" "}
              <span className="text-white">TODO</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {pending("all")} pending{doneCount > 0 ? ` · ${doneCount} done` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {installPrompt && (
              <button
                onClick={installPWA}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#ff6b00] text-white font-medium"
              >
                + Add to Home
              </button>
            )}
            {notifPerm !== "granted" && (
              <button
                onClick={requestNotif}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-zinc-300 hover:border-[#ff6b00]/50 hover:text-[#ff6b00] transition-colors"
              >
                🔔 Reminders
              </button>
            )}
            {notifPerm === "granted" && (
              <span className="text-xs text-green-400 border border-green-500/20 px-2 py-1 rounded-lg">
                🔔 On
              </span>
            )}
            {doneCount > 0 && (
              <button
                onClick={clearDone}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
              >
                Clear done
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full max-w-xl mx-auto px-4 pt-5 pb-24 flex flex-col gap-4">
        {/* Notif denied banner */}
        {notifPerm === "denied" && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            Notifications blocked — enable them in browser settings to get deadline reminders.
          </div>
        )}

        {/* Add task card */}
        <div className="rounded-2xl border border-white/8 bg-[#161616] p-4 flex flex-col gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="What needs to be done?"
            className="w-full bg-[#1e1e1e] border border-white/8 rounded-xl px-4 py-3 text-[15px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff6b00]/60 transition-colors"
          />

          {/* Deadline row */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type="date"
                value={dueDate}
                min={todayMin}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-[#ff6b00]/60 transition-colors [color-scheme:dark] appearance-none"
              />
            </div>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={!dueDate}
              className="flex-1 bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-[#ff6b00]/60 transition-colors disabled:opacity-25 disabled:cursor-not-allowed [color-scheme:dark]"
            />
            {dueDate && (
              <button
                onClick={() => { setDueDate(""); setDueTime(""); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/8 bg-[#1e1e1e] text-zinc-500 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>

          {/* Priority + submit */}
          <div className="flex gap-2">
            {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  priority === p
                    ? `${P[p].pill} border-current`
                    : "border-white/8 text-zinc-500 bg-transparent hover:text-zinc-300 hover:border-white/15"
                }`}
              >
                {P[p].label}
              </button>
            ))}
            <button
              onClick={addTodo}
              disabled={!input.trim()}
              className="px-5 py-2 bg-[#ff6b00] hover:bg-[#ff8533] active:bg-[#e06000] disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "critical", "high", "medium", "low"] as FilterPriority[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f
                  ? "bg-[#ff6b00] border-[#ff6b00] text-white"
                  : "border-white/10 text-zinc-400 hover:text-white hover:border-white/25"
              }`}
            >
              {f === "all" ? "All" : P[f as Priority].label}
              {" "}
              <span className={filter === f ? "opacity-80" : "opacity-50"}>
                {pending(f)}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowDone((v) => !v)}
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border border-white/10 text-zinc-400 hover:text-white hover:border-white/25 transition-all"
          >
            {showDone ? "Hide done" : "Show done"}
          </button>
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-2">
          {loading && (
            <div className="text-center py-16 text-zinc-600 text-sm">Loading…</div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">✓</p>
              <p className="text-sm text-zinc-600">Nothing here</p>
            </div>
          )}

          {sorted.map((todo) => {
            const overdue = todo.due_at && todo.due_at < Date.now() && !todo.completed;
            return (
              <div
                key={todo.id}
                className={`group flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                  todo.completed
                    ? "border-white/4 bg-[#111] opacity-45"
                    : overdue
                    ? "border-red-500/25 bg-[#161616]"
                    : "border-white/8 bg-[#161616] hover:border-white/14"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggle(todo.id)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    todo.completed
                      ? "bg-[#ff6b00] border-[#ff6b00]"
                      : "border-zinc-600 hover:border-[#ff6b00]"
                  }`}
                >
                  {todo.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] leading-snug break-words font-medium ${
                    todo.completed ? "line-through text-zinc-600" : "text-white"
                  }`}>
                    {todo.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Priority chip */}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${P[todo.priority].pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${P[todo.priority].dot}`} />
                      {P[todo.priority].label}
                    </span>
                    {/* Due chip */}
                    {todo.due_at && !todo.completed && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${dueChipColor(todo.due_at)}`}>
                        ⏱ {formatDue(todo.due_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => del(todo.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 p-0.5 flex-shrink-0 mt-0.5"
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

        {/* Footer */}
        {notifPerm === "granted" && (
          <p className="text-center text-xs text-zinc-700 -mt-1">
            Reminders: 1h · 30m · 10m · at deadline
          </p>
        )}
        {todos.length > 0 && (
          <p className="text-center text-xs text-zinc-800">
            {todos.length} tasks · synced to Cloudflare D1
          </p>
        )}
      </main>
    </div>
  );
}

// Augment Window for beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
