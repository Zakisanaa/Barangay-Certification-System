import ListTools from './ListTools';
import ChoiceOrCustom from './ChoiceOrCustom';
import {useUnsavedChanges,confirmDiscardChanges} from '../useUnsavedChanges';
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getKnowledgeEntries, getUnansweredQuestions, previewBanoy, resolveChatQuestion, saveKnowledge, subscribeChatbotChanges, trainBanoy } from "../chatbotData";
import ListPager from './ListPager';
import type { ChatReply, KnowledgeDraft, KnowledgeEntry, UnansweredQuestion } from "../chatbotData";

const emptyDraft = (): KnowledgeDraft => ({id:crypto.randomUUID(),title:"",question:"",answer:"",examples:[],active:false});
const inputClass = "min-h-11 w-full rounded border border-[#c9d1ca] bg-white px-3 py-2 text-base";
const buttonClass = "min-h-11 rounded bg-[#123323] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const cardClass = "space-y-4 rounded-lg border border-[#d7ddd7] bg-white p-4 sm:p-6";

export default function ChatbotKnowledgePage() {
  const [entryPage,setEntryPage]=useState(0),[questionPage,setQuestionPage]=useState(0);
  const [entries,setEntries] = useState<KnowledgeEntry[]>([]);
  const [questions,setQuestions] = useState<UnansweredQuestion[]>([]);
  const [draft,setDraft] = useState<KnowledgeDraft>(emptyDraft);
  const [examples,setExamples] = useState("");
  const [selectedQuestion,setSelectedQuestion] = useState<string|null>(null);
  const [search,setSearch] = useState("");
  const [sort,setSort]=useState("newest");
  const [testQuestion,setTestQuestion] = useState("");
  const [testDraft,setTestDraft] = useState(false);
  const [reply,setReply] = useState<ChatReply|null>(null);
  const [busy,setBusy] = useState(false);
  const [training,setTraining] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading]=useState(true);
  const lock = useRef(false);
  const editor = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const load = async () => {
    setLoading(true);
    try { const [knowledge,unanswered] = await Promise.all([getKnowledgeEntries(),getUnansweredQuestions()]); if (alive.current) { setEntries(knowledge);setQuestions(unanswered);setError(""); } }
    catch(cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Could not load Banoy knowledge."); }
    finally{if(alive.current)setLoading(false);}
  };
  useEffect(()=>{alive.current=true;void load(); const unsubscribe=subscribeChatbotChanges(()=>void load());return()=>{alive.current=false;unsubscribe();};},[]);
  const run = async (work:()=>Promise<void>) => {
    if(lock.current)return;lock.current=true;setBusy(true);
    try{await work();}catch(cause){toast.error(cause instanceof Error?cause.message:"Could not complete that action.");}finally{lock.current=false;if(alive.current)setBusy(false);}
  };
  const currentDraft = ():KnowledgeDraft => ({...draft,examples:examples.split("\n").map(line=>line.trim()).filter(Boolean)});
  const reset = () => {baseline.current=JSON.stringify({title:"",question:"",answer:"",examples:"",active:false});setDraft(emptyDraft());setExamples("");setSelectedQuestion(null);setReply(null);};
  const filteredEntries=entries.filter(entry=>(entry.title+' '+entry.question+' '+entry.answer).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==="name_asc"?a.title.localeCompare(b.title):sort==="name_desc"?b.title.localeCompare(a.title):((Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0))*(sort==="oldest"?-1:1));
  const fingerprint=JSON.stringify({title:draft.title,question:draft.question,answer:draft.answer,examples,active:draft.active});const baseline=useRef(JSON.stringify({title:'',question:'',answer:'',examples:'',active:false}));useUnsavedChanges(fingerprint!==baseline.current);
  const pending = entries.filter(entry=>entry.active && !entry.trained_at).length;
  return <div className="space-y-5 bg-[#f4f7f4] p-4 md:p-7">
    <header className={cardClass}>
      <h1 className="text-2xl font-bold text-[#122d1f]">Banoy knowledge</h1>
      <p className="text-sm leading-relaxed text-[#53645b]">Teach Banoy the answers approved by your office. It matches questions by meaning and returns the approved answer. Service settings and published announcements are included automatically.</p>
      <p className="text-sm text-[#53645b]">Save drafts for review, then publish them. Resident questions enter the review queue; staff approve what Banoy learns.</p>
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm">{entries.filter(entry=>entry.active).length} published · {pending} awaiting learning</span>
        <button disabled={busy} type="button" className={buttonClass} onClick={()=>void run(async()=>{
          let remaining=1,total=0;
          while(remaining>0 && alive.current){ const progress=await trainBanoy();total+=progress.trained;remaining=progress.remaining;setTraining(`Learned ${total} answers. ${remaining} remaining.`);if(!progress.trained && remaining)throw new Error("Some answers changed while learning. Refresh and try again."); }
          await load();toast.success("Banoy knowledge is up to date.");
        })}>Refresh learning</button>
      </div>
      {training && <p role="status" className="text-sm text-[#53645b]">{training}</p>}
    </header>
    {error && <div role="alert" className={cardClass}><p className="text-sm text-red-800">{error}</p><button type="button" className={buttonClass} onClick={()=>void load()}>Retry loading</button></div>}
    {loading&&<p role="status" className="text-sm">Loading Banoy knowledge and questions…</p>}
    <section ref={editor} className={cardClass}>
      <h2 className="text-lg font-bold">{draft.updated_at?"Edit an answer":"Teach a new answer"}</h2>
      {selectedQuestion && <p className="text-sm text-[#53645b]">Publishing this answer will mark the selected resident question reviewed.</p>}
      <form className="space-y-4" onSubmit={event=>{event.preventDefault();void run(async()=>{
        const result=await saveKnowledge(currentDraft());
        if(selectedQuestion && draft.active)await resolveChatQuestion(selectedQuestion);
        if(result.learned)toast.success(draft.active?"Answer published and learned by Banoy.":"Draft saved.");
        else toast.warning("Answer saved. Use Refresh learning to enable matching by meaning.");
        reset();await load();
      });}}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <ChoiceOrCustom label="Topic title" required maxLength={160} value={draft.title} onChange={title=>setDraft({...draft,title})} choices={["Document requirements","Service fees","Office hours","Booking an appointment","Claiming a certificate","Resident concerns"]}/>
          <label className="grid gap-1.5 text-sm font-semibold">Resident question<input required maxLength={500} value={draft.question} className={inputClass} onChange={event=>setDraft({...draft,question:event.target.value})} placeholder="For example: How do I request a residency certificate?" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Approved answer<textarea required rows={5} maxLength={4000} value={draft.answer} className={inputClass} onChange={event=>setDraft({...draft,answer:event.target.value})} placeholder="Enter the exact answer residents should receive." /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Other ways residents ask this question<textarea rows={3} maxLength={3000} value={examples} className={inputClass} onChange={event=>setExamples(event.target.value)} placeholder="One question per line, up to 15. Include Filipino wording residents use." /></label>
          <p className="text-sm text-[#53645b]">The meaning model supports English. Add Filipino questions here so Banoy can match that wording too.</p>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.active} onChange={event=>setDraft({...draft,active:event.target.checked})} />Publish this answer for residents</label>
          <div className="flex flex-wrap gap-2"><button className={buttonClass}>{busy?"Saving…":draft.active?"Save & teach Banoy":"Save draft"}</button><button type="button" className="min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold" onClick={()=>{if(confirmDiscardChanges())reset();}}>Clear editor</button></div>
        </fieldset>
      </form>
    </section>
    <section className={cardClass}>
      <h2 className="text-lg font-bold">Test Banoy</h2>
      <form className="space-y-3" onSubmit={event=>{event.preventDefault();void run(async()=>{setReply(await previewBanoy(testQuestion,testDraft?currentDraft():undefined));});}}>
        <label className="grid gap-1.5 text-sm font-semibold">Test question<input required maxLength={1000} disabled={busy} value={testQuestion} onChange={event=>setTestQuestion(event.target.value)} className={inputClass} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={testDraft} onChange={event=>setTestDraft(event.target.checked)} />Include the editor draft in this private test</label>
        <button disabled={busy || !testQuestion.trim()} className={buttonClass}>Test answer</button>
      </form>
      {reply && <div role="status" className="space-y-2 rounded border border-[#d7ddd7] bg-[#f7faf7] p-4"><p className="whitespace-pre-line break-words text-sm">{reply.answer}</p><p className="text-xs text-[#53645b]">{reply.source?`Source: ${reply.source}`:"No confirmed match"}{reply.method==="semantic"?" · Matched by meaning":""}</p>{!reply.modelAvailable && <p className="text-sm text-amber-800">Matching by meaning is temporarily unavailable. Banoy used approved wording and service information.</p>}</div>}
    </section>
    <section className={cardClass}>
      <ListPager page={questionPage} total={questions.length} onPage={setQuestionPage}/>
      <h2 className="text-lg font-bold">Questions to review ({questions.length})</h2>
      <p className="text-sm text-[#53645b]">Recent unanswered questions and answers marked unhelpful. Review the wording and add a confirmed answer.</p>
      {questions.length?questions.slice(questionPage*25,questionPage*25+25).map(question=><article key={question.id} className="space-y-2 border-t border-[#d7ddd7] pt-3"><p className="whitespace-pre-line break-words text-sm font-semibold">{question.question}</p><p className="text-xs text-[#53645b]">{new Date(question.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}{question.helpful===false?" · Marked unhelpful":" · Unanswered"}</p><div className="flex flex-wrap gap-2"><button disabled={busy} type="button" className={buttonClass} onClick={()=>{if(!confirmDiscardChanges())return;baseline.current=JSON.stringify({title:question.question.slice(0,160),question:question.question.slice(0,500),answer:"",examples:"",active:false});setDraft({...emptyDraft(),title:question.question.slice(0,160),question:question.question.slice(0,500)});setExamples("");setSelectedQuestion(question.id);editor.current?.scrollIntoView({behavior:"smooth"});}}>Teach an answer</button><button disabled={busy} type="button" className="min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold" onClick={()=>void run(async()=>{await resolveChatQuestion(question.id);await load();})}>Mark reviewed</button></div></article>):!loading&&!error?<p className="text-sm text-[#53645b]">No questions awaiting review.</p>:null}
    </section>
    <section className={cardClass}>
      <h2 className="text-lg font-bold">Saved knowledge</h2>
      <ListTools label="knowledge" query={search} onQuery={value=>{setEntryPage(0);setSearch(value);}} sort={sort} onSort={value=>{setEntryPage(0);setSort(value);}} options={[["newest","Recently updated first"],["oldest","Oldest update first"],["name_asc","Topic A-Z"],["name_desc","Topic Z-A"]]}/>
      {filteredEntries.slice(entryPage*25,entryPage*25+25).map(entry=><article key={entry.id} className="min-w-0 space-y-2 border-t border-[#d7ddd7] pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words font-bold">{entry.title}</h3><span className="text-xs text-[#53645b]">{entry.active?entry.trained_at?"Published · Learned":"Published · Learning pending":"Draft / inactive"}</span></div><p className="break-words text-sm text-[#53645b]">{entry.question}</p><p className="whitespace-pre-line break-words text-sm">{entry.answer}</p>{entry.source_key?<p className="text-xs text-[#53645b]">Updated automatically from {entry.source_key.startsWith("post:")?"Landing page news":"Services & booking"}. Edit the original information there.</p>:<button disabled={busy} type="button" className={buttonClass} onClick={()=>{if(!confirmDiscardChanges())return;baseline.current=JSON.stringify({title:entry.title,question:entry.question,answer:entry.answer,examples:entry.examples.join("\n"),active:entry.active});setDraft({id:entry.id,title:entry.title,question:entry.question,answer:entry.answer,examples:entry.examples,active:entry.active,updated_at:entry.updated_at});setExamples(entry.examples.join("\n"));setSelectedQuestion(null);editor.current?.scrollIntoView({behavior:"smooth"});}}>Edit answer</button>}</article>)}
      <ListPager page={entryPage} total={filteredEntries.length} onPage={setEntryPage}/>
      {!loading&&!error&&entries.length>0&&!filteredEntries.length&&<p className="text-sm text-[#53645b]">No answers match your search.</p>}
      {!loading&&!error&&!entries.length && <p className="text-sm text-[#53645b]">Add an approved answer to get started.</p>}
    </section>
  </div>;
}
