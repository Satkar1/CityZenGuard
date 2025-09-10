// server/services/generation/llm.ts
import { pipeline } from "@xenova/transformers";

let generator: any = null;
const LOCAL_GEN_MODEL =
  process.env.HUGGINGFACE_GENERATION_MODEL || "Xenova/flan-t5-small";

function buildPrompt(
  question: string,
  contexts: Array<{ title: string; text: string }>
) {
  const system = `You are a helpful legal assistant for Indian citizens. Use the provided context extracts (legal code, procedures, FAQs) to answer concisely and accurately. If the answer is uncertain, advise consulting a qualified lawyer.`;
  const ctxText = contexts
    .map((c, i) => `Context ${i + 1} - ${c.title}:\n${c.text}`)
    .join("\n\n---\n\n");
  return `${system}\n\n${ctxText}\n\nQuestion: ${question}\n\nAnswer:`;
}

export async function generateAnswer(
  question: string,
  contexts: Array<{ title: string; text: string }>,
  maxTokens = 256
) {
  if (!generator) {
    console.log(`[LLM] Loading local model: ${LOCAL_GEN_MODEL} ...`);
    generator = await pipeline("text2text-generation", LOCAL_GEN_MODEL);
  }

  const prompt = buildPrompt(question, contexts);

  try {
    const out = await generator(prompt, {
      max_new_tokens: maxTokens,
      do_sample: false,
      return_full_text: false,
    });

    if (Array.isArray(out) && out[0]?.generated_text) {
      return out[0].generated_text.trim();
    }

    return JSON.stringify(out).trim();
  } catch (err) {
    console.error("[LLM] Local generation failed:", err);
    throw err;
  }
}
