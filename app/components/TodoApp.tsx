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
  { label: string; color: string; dot: string; order: number }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    dot: "bg-red-500",
    order: 0,
  },
  high: {
    label: "High",
    color: "text-orange-400",
    dot: "bg-orange-500",
    order: 1,
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    dot: "bg-yellow-500",
    order: 2,
  },
  low: {
    label: "Low",
    color: "text-green-400",
    dot: "bg-green-600",
    order: 3,
  },
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<FilterPriority>("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("omkar-todos");
    if (saved) {
      try {
        setTodos(JSON.parse(saved));
      } catch {}
    }
  }, []);

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
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function clearCompleted() {
    setTodos((prev) => prev.filter((t) => !t.completed));
  }

  const filtered = todos
    .filter((t) => filter === "all" || t.priority === filter)
    .filter((t) => showCompleted || !t.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed)
        return a.completed ? 1 : -1;
      return (
        PRIORITY_CONFIG[a.priority].order -
        PRIORITY_CONFIG[b.priority].order ||
        b.createdAt - a.createdAt
      );
    });

  const counts: Record<FilterPriority, number> = {
    all: todos.filter((t) => !t.completed).length,
    critical: todos.filter((t) => t.priority === "critical" && !t.completed)
      .length,
    high: todos.filter((t) => t.priority === "high" && !t.completed).length,
    medium: todos.filter((t) => t.priority === "medium" && !t.completed)
      .length,
    low: todos.filter((t) => t.priority === "low" && !t.completed).length,
  };

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-[#ff6b00]">Omkar</span>{" "}
              <span className="text-white">TODO</span>
            </h1>
            <p className="text-xs text-[#555] mt-0.5">
              {counts.all} pending · {completedCount} done
            </p>
          </div>
          {completedCount > 0 && (
            <button
              onClick={clearCompleted}
              className="text-xs text-[#555] hover:text-red-400 transition-colors px-2 py-1 rounded border border-[#222] hover:border-red-900"
            >
              Clear done
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
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
          {(
            ["all", "critical", "high", "medium", "low"] as FilterPriority[]
          ).map((f) => (
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
            className={`ml-auto px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              showCompleted
                ? "border-[#222] text-[#555] hover:border-[#444]"
                : "bg-[#1a1a1a] border-[#333] text-[#888]"
            }`}
          >
            {showCompleted ? "Hide done" : "Show done"}
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#333]">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-sm">No tasks here</p>
            </div>
          )}
          {filtered.map((todo) => (
            <div
              key={todo.id}
              className={`group flex items-start gap-3 bg-[#111] border rounded-xl px-4 py-3 transition-all ${
                todo.completed
                  ? "border-[#161616] opacity-50"
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
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-relaxed break-words ${
                    todo.completed ? "line-through text-[#444]" : "text-white"
                  }`}
                >
                  {todo.text}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG[todo.priority].dot}`}
                  />
                  <span
                    className={`text-xs ${PRIORITY_CONFIG[todo.priority].color} opacity-70`}
                  >
                    {PRIORITY_CONFIG[todo.priority].label}
                  </span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#333] hover:text-red-500 p-0.5"
                aria-label="Delete task"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {todos.length > 0 && (
          <p className="text-center text-xs text-[#333] pb-4">
            {todos.length} total tasks · data saved locally
          </p>
        )}
      </main>
    </div>
  );
}
