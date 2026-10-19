import { confidentWordingMatch } from '../../supabase/functions/banoy-chat/retrieval.ts';
import {getRecognizedServiceFaq} from './serviceFaq';
const state=()=>window.__review;
export async function getKnowledgeEntries(){return structuredClone(state().knowledge??[]);}
export async function getUnansweredQuestions(){return structuredClone((state().chatQuestions??[]).filter(item=>!item.resolved && (!item.answered || item.helpful===false)));}
export function subscribeChatbotChanges(){return()=>{};}
export async function saveKnowledge(entry){const next={...entry,source_key:null,updated_at:new Date().toISOString(),trained_at:entry.active?new Date().toISOString():null};state().knowledge=[next,...(state().knowledge??[]).filter(item=>item.id!==entry.id)];return{entry:next,learned:true};}
export async function trainBanoy(){for(const entry of state().knowledge??[])if(entry.active)entry.trained_at=new Date().toISOString();return{trained:1,remaining:0,model:'gte-small'};}
export async function resolveChatQuestion(id){state().chatQuestions.find(item=>item.id===id).resolved=true;}
export async function previewBanoy(question,draft){const chosen=confidentWordingMatch(question,[...(state().knowledge??[]),...(draft?[{...draft,active:true}]:[])]);const baseline=getRecognizedServiceFaq(question,state().config);return{answer:chosen?.answer??baseline??'I do not have a confirmed answer yet.',source:chosen?.title??(baseline?'Barangay service settings':null),answered:Boolean(chosen||baseline),questionId:null,method:chosen?'wording':baseline?'service':'unanswered',modelAvailable:true};}
export async function askBanoy(question){const result=await previewBanoy(question);const id=crypto.randomUUID();state().chatQuestions??=[];state().chatQuestions.push({id,owner_id:state().account.id,answer_text:result.answer,answer_source:result.source,answer_method:result.method,answered_at:new Date().toISOString(),question,answered:result.answered,helpful:null,resolved:false,created_at:new Date().toISOString()});return{...result,questionId:id};}
export async function sendChatFeedback(id,helpful){state().chatQuestions.find(item=>item.id===id).helpful=helpful;return{success:true};}

export async function getBanoyHistory(ownerId,page=0){if(state().failHistory)throw new Error('Could not load Banoy history.');return structuredClone((state().chatQuestions??[]).filter(item=>item.owner_id===ownerId).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)).slice(page*25,page*25+25));}
