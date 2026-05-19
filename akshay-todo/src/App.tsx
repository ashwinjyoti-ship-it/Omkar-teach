import { useState, useEffect, useRef, useCallback } from "react";

type Priority = "critical" | "high" | "medium" | "low";
type FilterPriority = Priority | "all";

interface Todo {
  id: string;
  text: string;
  priority: Priority;
  completed: boolean;
  due_at: number | null; // unix ms
  created_at: number;
}

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; dot: string; order: number }
> = {
  critical: { label: "Critical", color: "text-red-400", dot: "bg-red-500", order: 0 },
  high: { label: "High", color: "text-orange-400", dot: "bg-orange-500", order: 1 },
  medium: { label: "Medium", color: "text-yellow-400", dot: "bg-yellow-500", order: 2 },
  low: { label: "Low", color: "text-green-400", dot: "bg-green-600", order: 3 },
};

// Escalating reminder thresholds in minutes before due_at
const REMINDER_THRESHOLDS = [60, 30, 10, 0];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatDue(due_at: number): string {
  const diff = due_at - Date.now();
  if (diff < 0) return "Overdue";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 23) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h left`;
  }
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return "Due now";
}

function dueColor(due_at: number): string {
  const diff = due_at - Date.now();
  if (diff < 0) return "text-red-500";
  if (diff < 10 * 60 * 1000) return "text-red-400";
  if (diff < 30 * 60 * 1000) return "text-orange-400";
  if (diff < 60 * 60 * 1000) return "text-yellow-400";
  return "text-[#555]";
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track which (id, threshold) combos have been notified this session
  const notifiedRef = useRef<Set<string>>(new Set());

  // Fetch todos from D1 via API
  async function fetchTodos() {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) setTodos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodos();
    setNotifPerm(Notification.permission);
    // Tick every 60s to refresh countdowns
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Escalating reminders — runs every tick
  const checkReminders = useCallback(() => {
    if (Notification.permission !== "granted") return;
    const now = Date.now();
    todos
      .filter((t) => !t.completed && t.due_at)
      .forEach((t) => {
        REMINDER_THRESHOLDS.forEach((mins) => {
          const key = `${t.id}-${mins}`;
          if (notifiedRef.current.has(key)) return;
          const diff = (t.due_at! - now) / 60000; // minutes remaining
          // Fire if we're within [mins, mins+2) minutes window
          if (diff <= mins && diff > mins - 2) {
            notifiedRef.current.add(key);
            const label =
              mins === 0
                ? "is due NOW"
                : mins === 10
                ? "is due in 10 minutes"
                : mins === 30
                ? "is due in 30 minutes"
                : "is due in 1 hour";
            new Notification(`⏰ Akshay TODO`, {
              body: `"${t.text}" ${label}`,
              icon: "/favicon.svg",
              tag: key,
            });
          }
        });
      });
  }, [todos]);

  useEffect(() => {
    checkReminders();
  }, [tick, checkReminders]);

  async function requestNotifPerm() {
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  }

  async function addTodo() {
    const text = input.trim();
    if (!text) return;
    let due_at: number | null = null;
    if (dueDate) {
      const dt = dueTime
        ? new Date(`${dueDate}T${dueTime}`)
        : new Date(`${dueDate}T23:59`);
      due_at = dt.getTime();
    }
    const todo: Todo = {
      id: uid(),
      text,
      priority,
      completed: false,
      due_at,
      created_at: Date.now(),
    };
    // Optimistic update
    setTodos((prev) => [todo, ...prev]);
    setInput("");
    setDueDate("");
    setDueTime("");
    inputRef.current?.focus();
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todo),
    });
  }

  async function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
    const todo = todos.find((t) => t.id === id)!;
    await fetch(`/api/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });
  }

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function clearCompleted() {
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    setTodos((prev) => prev.filter((t) => !t.completed));
    await Promise.all(ids.map((id) => fetch(`/api/todos/${id}`, { method: "DELETE" })));
  }

  const filtered = todos
    .filter((t) => filter === "all" || t.priority === filter)
    .filter((t) => showCompleted || !t.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Due tasks first within same priority
      if (a.due_at && !b.due_at) return -1;
      if (!a.due_at && b.due_at) return 1;
      if (a.due_at && b.due_at && a.due_at !== b.due_at) return a.due_at - b.due_at;
      return (
        PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order ||
        b.created_at - a.created_at
      );
    });

  const counts: Record<FilterPriority, number> = {
    all: todos.filter((t) => !t.completed).length,
    critical: todos.filter((t) => t.priority === "critical" && !t.completed).length,
    high: todos.filter((t) => t.priority === "high" && !t.completed).length,
    medium: todos.filter((t) => t.priority === "medium" && !t.completed).length,
    low: todos.filter((t) => t.priority === "low" && !t.completed).length,
  };

  const completedCount = todos.filter((t) => t.completed).length;

  // Min datetime-local value = now
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" key={tick}>
      {/* Header */}
      <header className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-[#ff6b00]">Akshay</span>{" "}
              <span className="text-white">TODO</span>
            </h1>
            <p className="text-xs text-[#555] mt-0.5">
              {counts.all} pending · {completedCount} done
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notifPerm !== "granted" && (
              <button
                onClick={requestNotifPerm}
                className="text-xs px-3 py-1 rounded-lg border border-[#ff6b00]/40 text-[#ff6b00] hover:bg-[#ff6b00]/10 transition-colors"
              >
                🔔 Enable reminders
              </button>
            )}
            {notifPerm === "granted" && (
              <span className="text-xs text-green-500 border border-green-900 px-2 py-1 rounded-lg">
                🔔 Reminders on
              </span>
            )}
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-[#555] hover:text-red-400 transition-colors px-2 py-1 rounded border border-[#222] hover:border-red-900"
              >
                Clear done
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Notification banner */}
        {notifPerm === "denied" && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-xl px-4 py-3 text-xs text-red-400">
            Browser notifications are blocked. Enable them in your browser settings to receive deadline reminders.
          </div>
        )}

        {/* Add Task */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="What needs to be done?"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#ff6b00] transition-colors"
          />

          {/* Due date/time */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="date"
                value={dueDate}
                min={nowLocal}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#888] focus:outline-none focus:border-[#ff6b00] transition-colors [color-scheme:dark]"
              />
            </div>
            <div className="flex-1">
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#888] focus:outline-none focus:border-[#ff6b00] transition-colors disabled:opacity-30 [color-scheme:dark]"
              />
            </div>
            {dueDate && (
              <button
                onClick={() => { setDueDate(""); setDueTime(""); }}
                className="text-[#555] hover:text-red-400 px-2 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Priority + Add */}
          <div className="flex items-center gap-2">
            {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  priority === p
                    ? `border-[#ff6b00] bg-[#ff6b00]/10 ${PRIORITY_CONFIG[p].color}`
                    : "border-[#222] text-[#444] hover:border-[#333] hover:text-[#666]"
                }`}
              >
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
            <button
              onClick={addTodo}
              disabled={!input.trim()}
              className="px-5 py-1.5 bg-[#ff6b00] hover:bg-[#ff8c33] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Filters */}
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
              {f === "all" ? "All" : PRIORITY_CONFIG[f].label}
              <span className="ml-1.5 opacity-70">{counts[f]}</span>
            </button>
          ))}
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="ml-auto px-3 py-1 rounded-full text-xs font-medium border border-[#222] text-[#555] hover:border-[#444] hover:text-[#888] transition-all"
          >
            {showCompleted ? "Hide done" : "Show done"}
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {loading && (
            <div className="text-center py-16 text-[#333]">
              <p className="text-sm">Loading tasks…</p>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-[#333]">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-sm">No tasks here</p>
            </div>
          )}
          {filtered.map((todo) => {
            const isOverdue = todo.due_at && todo.due_at < Date.now() && !todo.completed;
            return (
              <div
                key={todo.id}
                className={`group flex items-start gap-3 bg-[#111] border rounded-xl px-4 py-3 transition-all ${
                  todo.completed
                    ? "border-[#161616] opacity-50"
                    : isOverdue
                    ? "border-red-900/60 hover:border-red-800/60"
                    : "border-[#1e1e1e] hover:border-[#2a2a2a]"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    todo.completed
                      ? "bg-[#ff6b00] border-[#ff6b00]"
                      : "border-[#333] hover:border-[#ff6b00]"
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
                  <p className={`text-sm leading-relaxed break-words ${todo.completed ? "line-through text-[#444]" : "text-white"}`}>
                    {todo.text}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG[todo.priority].dot}`} />
                      <span className={`text-xs ${PRIORITY_CONFIG[todo.priority].color} opacity-70`}>
                        {PRIORITY_CONFIG[todo.priority].label}
                      </span>
                    </div>
                    {todo.due_at && !todo.completed && (
                      <span className={`text-xs font-medium ${dueColor(todo.due_at)}`}>
                        ⏱ {formatDue(todo.due_at)}
                      </span>
                    )}
                    {todo.due_at && todo.completed && (
                      <span className="text-xs text-[#333]">
                        Had deadline
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#333] hover:text-red-500 p-0.5"
                  aria-label="Delete task"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Reminder info */}
        {notifPerm === "granted" && (
          <p className="text-center text-xs text-[#2a2a2a] pb-2">
            Reminders fire at 1h · 30m · 10m · deadline
          </p>
        )}

        {todos.length > 0 && (
          <p className="text-center text-xs text-[#2a2a2a] pb-4">
            {todos.length} total · synced to D1
          </p>
        )}
      </main>
    </div>
  );
}
