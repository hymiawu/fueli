import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
// Thinking is always on for this model and counts toward max_tokens, so leave room beyond the JSON answer.
const MAX_TOKENS = 16000;
// If a safety classifier declines a request, the API re-runs it on Anthropic's recommended fallback model.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

let client;
const anthropic = () => (client ??= new Anthropic());

// Track usage per request for logging (no prompt/response content is logged).
export function newTrace(name) {
  return { name, calls: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0, flags: [] };
}

function record(trace, res) {
  if (!trace) return;
  trace.calls += 1;
  const u = res.usage ?? {};
  trace.inputTokens += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  trace.outputTokens += u.output_tokens ?? 0;
}

async function create(params, trace) {
  const res = await anthropic().beta.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, ...FALLBACK, ...params });
  record(trace, res);
  if (res.stop_reason === 'refusal') {
    trace?.flags.push('refusal');
    throw Object.assign(new Error('The AI declined this request'), { status: 422 });
  }
  return res;
}

const textOf = (res) => res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Model did not return JSON');
    return JSON.parse(m[0]);
  }
};

const validate = (schema, text) => {
  try {
    return schema.safeParse(parseJson(text));
  } catch (e) {
    return { success: false, error: e };
  }
};

// Base64 image -> Claude image block. The media type must match the bytes, so read it from the file signature.
export function imageBlock(b64) {
  const media_type = b64.startsWith('iVBOR') ? 'image/png' : b64.startsWith('R0lG') ? 'image/gif' : b64.startsWith('UklG') ? 'image/webp' : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type, data: b64 } };
}

/**
 * Ask for a JSON object, validate it against a zod schema, and retry once with the
 * validation error if it doesn't conform. `effort` trades depth of thinking for speed and cost.
 */
export async function jsonCompletion({ system, messages, schema, effort = 'medium', trace, extra = {} }) {
  const convo = [...messages];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await create({ system, messages: convo, output_config: { effort }, ...extra }, trace);
    const parsed = validate(schema, textOf(res));
    if (parsed.success) return parsed.data;
    trace?.flags.push('schema_retry');
    // Append the full response (including thinking blocks) unchanged, then ask for a fix.
    convo.push({ role: 'assistant', content: res.content });
    convo.push({
      role: 'user',
      content: `That JSON did not match the required schema: ${String(parsed.error?.message ?? parsed.error).slice(0, 800)}. Return the corrected JSON only.`,
    });
  }
  throw Object.assign(new Error('AI returned an invalid response'), { status: 502 });
}

/**
 * Minimal tool-using agent loop. `tools` maps name -> { description, parameters, run }.
 * Returns the final answer, validated against `finalSchema`, once the model stops calling tools.
 */
export async function runAgent({ system, messages, tools, maxSteps = 4, effort = 'medium', trace, finalSchema }) {
  const toolDefs = Object.entries(tools).map(([name, t]) => ({ name, description: t.description, input_schema: t.parameters }));
  const convo = [...messages];
  for (let step = 0; step < maxSteps; step++) {
    const res = await create({ system, messages: convo, tools: toolDefs, output_config: { effort } }, trace);
    convo.push({ role: 'assistant', content: res.content });
    const calls = res.content.filter((b) => b.type === 'tool_use');
    if (!calls.length) {
      const parsed = validate(finalSchema, textOf(res));
      if (parsed.success) return parsed.data;
      break;
    }
    const results = [];
    for (const call of calls) {
      trace && (trace.toolCalls += 1);
      const tool = tools[call.name];
      let result;
      let failed = !tool;
      try {
        result = tool ? await tool.run(call.input ?? {}) : { error: 'unknown tool' };
      } catch (e) {
        result = { error: e.message };
        failed = true;
      }
      results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result).slice(0, 8000), is_error: failed });
    }
    convo.push({ role: 'user', content: results });
  }
  // Final structured answer, with tools' results already in context.
  return jsonCompletion({
    system,
    messages: [...convo, { role: 'user', content: 'Now return the final answer as JSON matching the required format.' }],
    schema: finalSchema,
    effort,
    trace,
    extra: { tools: toolDefs, tool_choice: { type: 'none' } },
  });
}

export const modelName = MODEL;
