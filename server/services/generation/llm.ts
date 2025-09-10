// server/services/generation/llm.ts
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const HF_GEN_MODEL =
  process.env.HUGGINGFACE_GENERATION_MODEL || "google/flan-t5-small";

function buildPrompt(
  question: string,
  contexts: Array<{ title: string; text: string }>
) {
  const system = `You are a helpful legal assistant for Indian citizens. Use the provided context extracts (legal code, procedures, FAQs) to answer the question concisely and accurately. If the answer is uncertain, advise consulting a qualified lawyer.`;
  const ctxText = contexts
    .map((c, i) => `Context ${i + 1} - ${c.title}:\n${c.text}`)
    .join("\n\n---\n\n");
  const prompt = `${system}\n\n${ctxText}\n\nQuestion: ${question}\n\nAnswer:`;
  return prompt;
}

export async function generateAnswer(
  question: string,
  contexts: Array<{ title: string; text: string }>,
  maxTokens = 256
) {
  if (!HF_TOKEN) {
    throw new Error("HUGGINGFACE_API_TOKEN is not set");
  }

  const prompt = buildPrompt(question, contexts);
  const url = `https://api-inference.huggingface.co/models/${HF_GEN_MODEL}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          do_sample: false,
          return_full_text: false, // ✅ prevents echoing the whole prompt
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HF generation failed: ${res.status} ${text}`);
    }

    const json = await res.json();

    // Hugging Face text generation responses can differ:
    // - CausalLM: [{ generated_text }]
    // - Seq2Seq (T5, BART): [{ generated_text }]
    // - Token classification/other errors may return objects
    let textOutput = "";

    if (Array.isArray(json)) {
      if (json[0]?.generated_text) {
        textOutput = json[0].generated_text;
      } else if (json[0]?.summary_text) {
        textOutput = json[0].summary_text;
      }
    } else if (json.generated_text) {
      textOutput = json.generated_text;
    } else if (typeof json === "string") {
      textOutput = json;
    } else {
      textOutput = JSON.stringify(json);
    }

    return textOutput.trim();
  } catch (err) {
    console.error("Error generating with HF:", err);
    throw err;
  }
}
