import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { confidentWordingMatch, confidentSemanticMatch, rankByWording, validateKnowledge } from "./retrieval.ts";
import type { Knowledge } from "./retrieval.ts";
import { getRecognizedServiceFaq } from "../../../src/app/serviceFaq.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, "Content-Type": "application/json" } });
const columns = "id,title,question,answer,examples,active,source_key,updated_at,trained_at";
// Supabase supplies this global in the hosted Edge Runtime.
declare const Supabase: {ai:{Session:new (model:"gte-small")=>{run(input:string,options:{mean_pool:boolean;normalize:boolean}):Promise<number[]>}}};
let model: InstanceType<typeof Supabase.ai.Session> | undefined;
async function embed(text: string): Promise<number[]> {
  model ??= new Supabase.ai.Session("gte-small");
  const result = await model.run(text.slice(0,2400), { mean_pool: true, normalize: true });
  const vector = Array.from(result as ArrayLike<number>);
  if (vector.length !== 384 || vector.some(value=>!Number.isFinite(value))) throw new Error("The language model returned an invalid vector.");
  return vector;
}
const validId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." },405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return json({error:"Banoy is not configured."},503);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({error:"Sign in to use Banoy."},401);
  if (Number(request.headers.get("content-length")) > 25000) return json({error:"Request is too large."},413);
  const caller = createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const server = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError} = await caller.auth.getUser(authorization.slice(7));
  let internal = false;
  if (identityError || !identity.user) {
    const permission = await caller.rpc("chatbot_service_access");
    internal = !permission.error && permission.data === true;
    if (!internal) return json({error:"Your session expired. Sign in again."},401);
  }
  const staffResult = identity.user ? await server.from("resident_profiles").select("role").eq("id",identity.user.id).single() : null;
  const staff = internal || staffResult?.data?.role === "staff";
  let body: Record<string,unknown>;
  try { const raw = await request.text(); if (raw.length > 25000) return json({error:"Request is too large."},413); body=JSON.parse(raw); if (!body || typeof body !== "object") throw new Error(); }
  catch { return json({error:"Provide a valid request."},400); }
  const action = body.action ?? "ask";
  if (!["ask","save","train","preview","feedback"].includes(String(action))) return json({error:"Unknown action."},400);
  if (["save","train","preview"].includes(String(action)) && !staff) return json({error:"Only staff can teach or test Banoy."},403);

  try {
    const teach = async (entry: Knowledge) => {
      const embedding = await embed([entry.question,...entry.examples].join("\n"));
      const result = await server.from("chatbot_knowledge").update({embedding,trained_at:new Date().toISOString()}).eq("id",entry.id).eq("updated_at",entry.updated_at).select("id");
      if (result.error) throw result.error;
      return Boolean(result.data?.length);
    };
    if (action === "save") {
      const entry = validateKnowledge(body.entry);
      const input = body.entry as Record<string,unknown>;
      if (!validId(input.id)) return json({error:"Provide a valid entry ID."},400);
      let result;
      if (input.updated_at) {
        result = await server.from("chatbot_knowledge").update(entry).eq("id",input.id).is("source_key",null).eq("updated_at",input.updated_at).select(columns).maybeSingle();
      } else result = await server.from("chatbot_knowledge").insert({...entry,id:input.id}).select(columns).single();
      if (result.error) throw result.error;
      if (!result.data) return json({error:"Another staff member changed this answer. Reload and review it before saving."},409);
      let learned = !entry.active;
      if (entry.active) { try { learned = await teach(result.data); } catch { learned=false; } }
      return json({entry:result.data,learned});
    }
    if (action === "train") {
      const pending = await server.from("chatbot_knowledge").select(columns).eq("active",true).is("embedding",null).order("updated_at").limit(5);
      if (pending.error) throw pending.error;
      let trained=0;
      for (const entry of pending.data ?? []) if (await teach(entry)) trained++;
      const remaining = await server.from("chatbot_knowledge").select("id",{count:"exact",head:true}).eq("active",true).is("embedding",null);
      if (remaining.error) throw remaining.error;
      return json({trained,remaining:remaining.count,model:"gte-small"});
    }
    if (action === "feedback") {
      if (!identity.user || !validId(body.id) || typeof body.helpful !== "boolean") return json({error:"Provide valid answer feedback."},400);
      const result = await server.from("chatbot_questions").update({helpful:body.helpful}).eq("id",body.id).eq("owner_id",identity.user.id).select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) return json({error:"Answer not found."},404);
      return json({success:true});
    }
    if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 1000) return json({error:"Ask a question under 1000 characters."},400);
    const question = body.question.trim();
    const preview = action === "preview";
    if (internal && !preview) return json({error:"Use preview for server checks."},400);
    let questionId: string | null = null;
    if (!preview) {
      const reserved = await caller.rpc("reserve_chatbot_question",{p_question:question});
      if (reserved.error) return json({error:reserved.error.message},429);
      questionId = reserved.data;
    }
    const loaded = await server.from("chatbot_knowledge").select(columns).eq("active",true).order("id").limit(1000);
    if (loaded.error) throw loaded.error;
    const entries: Knowledge[] = loaded.data ?? [];
    // A draft can be tested privately without making it available to residents.
    if (preview && body.draft) {
      const draft = validateKnowledge(body.draft);
      const draftId = validId((body.draft as Record<string,unknown>).id) ? (body.draft as Record<string,unknown>).id as string : crypto.randomUUID();
      const position = entries.findIndex(entry=>entry.id===draftId);
      if (position>=0) entries.splice(position,1);
      entries.push({...draft,id:draftId,active:true,source_key:null,updated_at:"preview"});
    }
    let chosen = confidentWordingMatch(question,entries);
    let method = "wording";
    let modelAvailable = true;
    let baseline: string | null = null;
    if (!chosen) {
      const [services, office] = await Promise.all([server.from("service_catalog").select("*"),server.from("office_settings").select("*").eq("id",1).single()]);
      if (services.error || office.error) throw services.error ?? office.error;
      baseline = getRecognizedServiceFaq(question,{services:services.data ?? [],office:office.data});
      // Custom answers are considered by meaning before falling back to service rules.
      try {
        const queryVector = await embed(question);
        const fresh = rankByWording(question,entries).filter(item=>item.entry.updated_at!=="preview").slice(0,3);
        for (const candidate of fresh) {
          const state = await server.from("chatbot_knowledge").select("embedding").eq("id",candidate.entry.id).single();
          if (state.error) throw state.error;
          if (!state.data?.embedding) await teach(candidate.entry);
        }
        const matches = await server.rpc("match_chatbot_knowledge",{query_embedding:queryVector});
        if (matches.error) throw matches.error;
        const semanticMatches = [...(matches.data ?? [])];
        const draft = entries.find(entry=>entry.updated_at==="preview");
        if (draft) { const vector = await embed([draft.question,...draft.examples].join("\n")); semanticMatches.push({id:draft.id,similarity:queryVector.reduce((sum,value,index)=>sum+value*vector[index],0)}); }
        chosen = confidentSemanticMatch(semanticMatches,entries);
        method = "semantic";
      } catch { modelAvailable=false; }
    }
    const answered = Boolean(chosen || baseline);
    const answer = chosen?.answer ?? baseline ?? `I don't have a confirmed answer for that yet. ${preview ? "Staff can add an approved answer in Banoy knowledge." : "Your question has been saved for staff review."} You can also contact the barangay office or send a message in your request conversation. Please include the document or service name if you can.`;
    const source = chosen?.title ?? (baseline ? "Barangay service settings" : null);
    if (questionId) {
      const saved = await server.from("chatbot_questions").update({knowledge_id:chosen?.updated_at==="preview" ? null : chosen?.id ?? null,answered}).eq("id",questionId);
      if (saved.error) throw saved.error;
    }
    return json({answer,source,answered,questionId,method:chosen?method:baseline?"service":"unanswered",modelAvailable});
  } catch (cause) {
    console.error("Banoy request failed.",cause instanceof Error ? cause.message : "Database or model unavailable");
    const validation = cause instanceof Error && /^(Enter a valid|Use up to|Choose whether|Provide a knowledge)/.test(cause.message);
    return json({error:validation ? (cause as Error).message : "Banoy could not finish that request. Please try again."},validation?400:503);
  }
});
