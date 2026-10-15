export interface Knowledge {
  id: string; title: string; question: string; answer: string; examples: string[];
  active: boolean; source_key: string | null; updated_at: string;
}
export function normalizeQuestion(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
const stopwords = new Set("a an the is are was what how do does can could i we you my your for to of in at and please po ba ang ng mga ko ako paano ano when where it this that about tell me would like need know want".split(" "));
function tokens(text: string) { return new Set(normalizeQuestion(text).split(" ").filter(word => word && !stopwords.has(word))); }

export function rankByWording(query: string, entries: Knowledge[]) {
  const normalized = normalizeQuestion(query);
  const queryTokens = tokens(query);
  return entries.filter(entry => entry.active).map(entry => {
    let score = 0;
    for (const phrase of [entry.question, ...entry.examples, entry.title]) {
      if (normalizeQuestion(phrase) === normalized) { score = 1; break; }
      const words = tokens(phrase);
      if (!words.size || !queryTokens.size) continue;
      const overlap = [...queryTokens].filter(word => words.has(word)).length;
      const similarity = overlap / (queryTokens.size + words.size - overlap);
      score = Math.max(score, similarity * 0.95);
    }
    return { entry, score };
  }).sort((a,b) => b.score - a.score || Number(a.entry.source_key !== null) - Number(b.entry.source_key !== null));
}

export function confidentWordingMatch(query: string, entries: Knowledge[]) {
  const ranked = rankByWording(query, entries);
  const [first, second] = ranked;
  if (!first) return null;
  if (first.score === 1 && (!second || second.score < 1 || first.entry.answer === second.entry.answer)) return first.entry;
  if (first.score >= 0.72 && (!second || first.score - second.score >= 0.12)) return first.entry;
  return null;
}

export function confidentSemanticMatch(matches: {id: string; similarity: number}[], entries: Knowledge[]) {
  const ranked = matches.filter(match => Number.isFinite(match.similarity) && entries.some(entry => entry.id === match.id && entry.active)).sort((a,b)=>b.similarity-a.similarity);
  const [first, second] = ranked;
  if (!first || first.similarity < 0.82 || (second && first.similarity - second.similarity < 0.035)) return null;
  return entries.find(entry => entry.id === first.id) ?? null;
}

export function validateKnowledge(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Provide a knowledge entry.");
  const data = input as Record<string, unknown>;
  for (const [key, maximum] of [["title",160],["question",500],["answer",4000]] as const) {
    if (typeof data[key] !== "string" || !data[key].trim() || data[key].trim().length > maximum) throw new Error(`Enter a valid ${key} (up to ${maximum} characters).`);
  }
  if (!Array.isArray(data.examples) || data.examples.length > 15 || data.examples.some(example => typeof example !== "string" || example.trim().length > 200)) throw new Error("Use up to 15 alternate questions, each under 200 characters.");
  if (typeof data.active !== "boolean") throw new Error("Choose whether to publish this answer.");
  return { title: (data.title as string).trim(), question: (data.question as string).trim(), answer: (data.answer as string).trim(), examples: [...new Set((data.examples as string[]).map(example=>example.trim()).filter(Boolean))], active: data.active };
}
