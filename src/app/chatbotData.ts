import {readAll,reliableSubscription} from './reliableData';
import { requireSupabase, supabase } from "./supabase";

export interface KnowledgeEntry {
  id: string; title: string; question: string; answer: string; examples: string[]; active: boolean;
  source_key: string | null; updated_at: string; trained_at: string | null;
}
export type KnowledgeDraft = Pick<KnowledgeEntry,"id"|"title"|"question"|"answer"|"examples"|"active"> & {updated_at?: string};
export interface ChatReply { answer: string; source: string | null; answered: boolean; questionId: string | null; method: string; modelAvailable: boolean }
export interface UnansweredQuestion { id: string; question: string; helpful: boolean | null; answered: boolean; created_at: string; resolved: boolean }
export interface BanoyHistory {id:string;question:string;answer_text:string|null;answer_source:string|null;created_at:string;answered_at:string|null;helpful:boolean|null}
export async function getBanoyHistory(ownerId:string,page=0):Promise<BanoyHistory[]>{const{data,error}=await requireSupabase().from('chatbot_questions').select('id,question,answer_text,answer_source,created_at,answered_at,helpful').eq('owner_id',ownerId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24);if(error)throw new Error('Could not load your Banoy history. Try again when connected.');return data;}
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
  return readAll<KnowledgeEntry>((from,to)=>requireSupabase().from("chatbot_knowledge").select(columns).order("updated_at",{ascending:false}).order("id").range(from,to));
}
export async function getUnansweredQuestions(): Promise<UnansweredQuestion[]> {
  return readAll<UnansweredQuestion>((from,to)=>requireSupabase().from("chatbot_questions").select("id,question,helpful,answered,created_at,resolved").eq("resolved",false).or("answered.eq.false,helpful.eq.false").order("created_at",{ascending:false}).order("id").range(from,to));
}
export async function resolveChatQuestion(id: string) {
  const {error} = await requireSupabase().from("chatbot_questions").update({resolved:true}).eq("id",id);
  if (error) throw new Error(error.message);
}
export function subscribeChatbotChanges(refresh:()=>void){return reliableSubscription(['chatbot_knowledge','chatbot_questions'],refresh);}
