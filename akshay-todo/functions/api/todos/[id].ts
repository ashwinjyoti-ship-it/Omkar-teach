interface Env {
  DB: D1Database;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = params.id as string;
  const body = (await request.json()) as { completed?: boolean; text?: string; priority?: string; due_at?: number | null };
  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.completed !== undefined) { sets.push("completed = ?"); values.push(body.completed ? 1 : 0); }
  if (body.text !== undefined) { sets.push("text = ?"); values.push(body.text); }
  if (body.priority !== undefined) { sets.push("priority = ?"); values.push(body.priority); }
  if (body.due_at !== undefined) { sets.push("due_at = ?"); values.push(body.due_at); }
  if (sets.length === 0) return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  values.push(id);
  await env.DB.prepare(`UPDATE todos SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string;
  await env.DB.prepare("DELETE FROM todos WHERE id = ?").bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS });
