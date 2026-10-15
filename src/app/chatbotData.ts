import { requireSupabase, supabase } from "./supabase";

export interface KnowledgeEntry {
  id: string; title: string; question: string; answer: string; examples: string[]; active: boolean;
  source_key: string | null; updated_at: string; trained_at: string | null;
}
export type KnowledgeDraft = Pick<KnowledgeEntry,"id"|"title"|"question"|"answer"|"examples"|"active"> & {updated_at?: string};
export interface ChatReply { answer: string; source: string | null; answered: boolean; questionId: string | null; method: string; modelAvailable: boolean }
export interface UnansweredQuestion { id: string; question: string; helpful: boolean | null; answered: boolean; created_at: string; resolved: boolean }
const columns = "id,title,question,answer,examples,active,source_key,updated_at,trained_at";

async function invoke<T>(body: Record<string,unknown>): Promise<T> {
  const {data,error} = await requireSupabase().functions.invoke("banoy-chat",{body});
  if (error) {
    if (error.context instanceof Response) {
      const detail = await error.context.clone().json().catch(()=>null);
      if (typeof detail?.error === "string") throw new Error(detail.error);
    }
    throw new Error("Could not connect to Banoy. Please try again.");
  }
  return data;
}
export const askBanoy = (question: string) => invoke<ChatReply>({action:"ask",question});
export const previewBanoy = (question: string, draft?: KnowledgeDraft) => invoke<ChatReply>({action:"preview",question,...(draft ? {draft} : {})});
export const saveKnowledge = (entry: KnowledgeDraft) => invoke<{entry:KnowledgeEntry;learned:boolean}>({action:"save",entry});
export const trainBanoy = () => invoke<{trained:number;remaining:number;model:string}>({action:"train"});
export const sendChatFeedback = (id: string, helpful: boolean) => invoke<{success:boolean}>({action:"feedback",id,helpful});
export async function getKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  const {data,error} = await requireSupabase().from("chatbot_knowledge").select(columns).order("updated_at",{ascending:false}).limit(1000);
  if (error) throw new Error(error.message);
  return data;
}
export async function getUnansweredQuestions(): Promise<UnansweredQuestion[]> {
  const {data,error} = await requireSupabase().from("chatbot_questions").select("id,question,helpful,answered,created_at,resolved").eq("resolved",false).or("answered.eq.false,helpful.eq.false").order("created_at",{ascending:false}).limit(100);
  if (error) throw new Error(error.message);
  return data;
}
export async function resolveChatQuestion(id: string) {
  const {error} = await requireSupabase().from("chatbot_questions").update({resolved:true}).eq("id",id);
  if (error) throw new Error(error.message);
}
export function subscribeChatbotChanges(refresh: () => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client.channel(`banoy-admin-${crypto.randomUUID()}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"chatbot_knowledge"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"chatbot_questions"},refresh).subscribe();
  return () => { void client.removeChannel(channel); };
}
