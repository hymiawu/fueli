import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
let client;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Track usage per request for logging (no prompt/response content is logged).
export function newTrace(name) {
  return { name, calls: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0, flags: [] };
}

function record(trace, res) {
  if (!trace) return;
  trace.calls += 1;
  trace.inputTokens += res.usage?.prompt_tokens ?? 0;
  trace.outputTokens += res.usage?.completion_tokens ?? 0;
}

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Model did not return JSON');
    return JSON.parse(m[0]);
  }
};

/**
 * Ask for a JSON object, validate it against a zod schema, and retry once with the
 * validation error if it doesn't conform.
 */
export async function jsonCompletion({ system, messages, schema, maxTokens = 1200, temperature = 0.4, trace, extra = {} }) {
  const convo = [{ role: 'system', content: system }, ...messages];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai().chat.completions.create({
      model: MODEL,
      messages: convo,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: 'json_object' },
      ...extra,
    });
    record(trace, res);
    const text = res.choices[0]?.message?.content ?? '';
    let parsed;
    try {
      parsed = schema.safeParse(parseJson(text));
    } catch (e) {
      parsed = { success: false, error: e };
    }
    if (parsed.success) return parsed.data;
    trace?.flags.push('schema_retry');
    convo.push({ role: 'assistant', content: text });
    convo.push({
      role: 'user',
      content: `That JSON did not match the required schema: ${String(parsed.error?.message ?? parsed.error).slice(0, 800)}. Return the corrected JSON only.`,
    });
  }
  throw Object.assign(new Error('AI returned an invalid response'), { status: 502 });
}

/**
 * Minimal tool-using agent loop. `tools` maps name -> { description, parameters, run }.
 * Returns the final assistant text once the model stops calling tools.
 */
export async function runAgent({ system, messages, tools, maxSteps = 4, maxTokens = 2400, trace, finalSchema }) {
  const toolDefs = Object.entries(tools).map(([name, t]) => ({
    type: 'function',
    function: { name, description: t.description, parameters: t.parameters },
  }));
  const convo = [{ role: 'system', content: system }, ...messages];
  for (let step = 0; step < maxSteps; step++) {
    const res = await openai().chat.completions.create({
      model: MODEL,
      messages: convo,
      tools: toolDefs,
      max_tokens: maxTokens,
      temperature: 0.5,
    });
    record(trace, res);
    const msg = res.choices[0].message;
    if (!msg.tool_calls?.length) break;
    convo.push(msg);
    for (const call of msg.tool_calls) {
      trace && (trace.toolCalls += 1);
      const tool = tools[call.function.name];
      let result;
      try {
        result = tool ? await tool.run(JSON.parse(call.function.arguments || '{}')) : { error: 'unknown tool' };
      } catch (e) {
        result = { error: e.message };
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 8000) });
    }
  }
  // Final structured answer, with tools' results already in context.
  return jsonCompletion({
    system,
    messages: [...convo.slice(1), { role: 'user', content: 'Now return the final answer as JSON matching the required format.' }],
    schema: finalSchema,
    maxTokens,
    trace,
    extra: { tools: toolDefs, tool_choice: 'none' },
  });
}

export const modelName = MODEL;
