interface Env {
  DB: D1Database;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT * FROM todos ORDER BY completed ASC, due_at ASC NULLS LAST, created_at DESC"
  ).all();
  return new Response(JSON.stringify(results), { headers: CORS });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as {
    id: string;
    text: string;
    priority: string;
    completed: boolean;
    due_at: number | null;
    created_at: number;
  };
  await env.DB.prepare(
    "INSERT INTO todos (id, text, priority, completed, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(body.id, body.text, body.priority, body.completed ? 1 : 0, body.due_at ?? null, body.created_at)
    .run();
  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS });
