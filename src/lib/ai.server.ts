// Server-only: streamed call to Lovable AI Gateway (Responses API), returns final text.
const URL = "https://ai.gateway.lovable.dev/v1/responses";

export class AiError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export async function askAI(opts: {
  instructions: string;
  input: string;
  schema?: { name: string; schema: Record<string, unknown> };
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "LOVABLE_API_KEY missing");
  const body: Record<string, unknown> = {
    model: "openai/gpt-6-astra",
    instructions: opts.instructions,
    input: opts.input,
    stream: true,
    store: false,
    reasoning: { effort: "low" },
  };
  if (opts.schema) body["text"] = { format: { type: "json_schema", name: opts.schema.name, strict: true, schema: opts.schema.schema } };
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    console.error(`AI gateway ${res.status}: ${t}`);
    throw new AiError(res.status, `AI ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") throw new AiError(500, "AI failed");
      } catch (e) { if (e instanceof AiError) throw e; }
    }
  }
  return out.trim();
}
