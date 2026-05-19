"use client";

import { useState, useEffect, useRef } from "react";

type Priority = "critical" | "high" | "medium" | "low";
type FilterPriority = Priority | "all";

interface Todo {
  id: string;
  text: string;
  priority: Priority;
  completed: boolean;
  createdAt: number;
}

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; dot: string; badge: string; order: number }
> = {
  critical: {
    label: "Critical",
    color: "text-red-300",
    dot: "bg-red-400",
    badge: "bg-red-500/15 border-red-500/40",
    order: 0,
  },
  high: {
    label: "High",
    color: "text-orange-300",
    dot: "bg-orange-400",
    badge: "bg-orange-500/15 border-orange-500/40",
    order: 1,
  },
  medium: {
    label: "Medium",
    color: "text-amber-300",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 border-amber-500/40",
    order: 2,
  },
  low: {
    label: "Low",
    color: "text-emerald-300",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 border-emerald-500/40",
    order: 3,
  },
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("omkar-todos");
      return saved ? (JSON.parse(saved) as Todo[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("omkar-todos", JSON.stringify(todos));
  }, [todos]);

  function addTodo() {
    const text = input.trim();
    if (!text) return;

    setTodos((prev) => [
      { id: uid(), text, priority, completed: false, createdAt: Date.now() },
      ...prev,
    ]);
    setInput("");
    inputRef.current?.focus();
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }

  function clearCompleted() {
    setTodos((prev) => prev.filter((todo) => !todo.completed));
  }

  const filtered = todos
    .filter((todo) => filter === "all" || todo.priority === filter)
    .filter((todo) => showCompleted || !todo.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (
        PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order ||
        b.createdAt - a.createdAt
      );
    });

  const counts: Record<FilterPriority, number> = {
    all: todos.filter((todo) => !todo.completed).length,
    critical: todos.filter(
      (todo) => todo.priority === "critical" && !todo.completed
    ).length,
    high: todos.filter((todo) => todo.priority === "high" && !todo.completed)
      .length,
    medium: todos.filter(
      (todo) => todo.priority === "medium" && !todo.completed
    ).length,
    low: todos.filter((todo) => todo.priority === "low" && !todo.completed)
      .length,
  };

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/90">
                Personal planner
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                Omkar Taskboard
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {counts.all} pending · {completedCount} completed
              </p>
            </div>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
              >
                Clear completed
              </button>
            )}
          </div>
        </header>

        <main className="mt-6 space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTodo()}
                placeholder="Add a clear, actionable task"
                className="h-11 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/70 focus:outline-none"
              />
              <button
                onClick={addTodo}
                disabled={!input.trim()}
                className="h-11 rounded-xl bg-indigo-500 px-5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add task
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    priority === p
                      ? `${PRIORITY_CONFIG[p].badge} ${PRIORITY_CONFIG[p].color}`
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-2">
            {(["all", "critical", "high", "medium", "low"] as FilterPriority[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    filter === item
                      ? "border-indigo-400/70 bg-indigo-500/20 text-indigo-100"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  {item === "all" ? "All" : PRIORITY_CONFIG[item].label}
                  <span className="ml-1.5 opacity-70">{counts[item]}</span>
                </button>
              )
            )}

            <button
              onClick={() => setShowCompleted((value) => !value)}
              className="ml-auto rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20"
            >
              {showCompleted ? "Hide completed" : "Show completed"}
            </button>
          </section>

          <section className="space-y-2">
            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/60 py-14 text-center text-slate-400">
                No tasks in this view
              </div>
            )}

            {filtered.map((todo) => (
              <article
                key={todo.id}
                className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                  todo.completed
                    ? "border-white/10 bg-slate-900/40 opacity-60"
                    : "border-white/10 bg-slate-900/80 hover:border-white/20"
                }`}
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 transition ${
                    todo.completed
                      ? "border-indigo-400 bg-indigo-400"
                      : "border-slate-500 hover:border-indigo-300"
                  }`}
                  aria-label="Toggle task"
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      todo.completed ? "text-slate-500 line-through" : "text-slate-100"
                    }`}
                  >
                    {todo.text}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CONFIG[todo.priority].dot}`}
                    />
                    <span
                      className={`text-xs ${PRIORITY_CONFIG[todo.priority].color}`}
                    >
                      {PRIORITY_CONFIG[todo.priority].label}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
                  aria-label="Delete task"
                >
                  ✕
                </button>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
