import {requireSupabase} from './supabase';
import {CHAT_MAX_FILES,validateChatFile} from './chatFiles';
export type ConversationKind='request'|'concern';
export interface ChatAttachment {id:string;kind:ConversationKind;reference:string;request_message_id:string|null;concern_message_id:string|null;storage_path:string;file_name:string;mime_type:string;file_size:number;created_at:string}
export async function readChatAttachments(kind:ConversationKind,reference:string){
 const rows:ChatAttachment[]=[];
 for(let page=0;;page++){
  const result=await requireSupabase().from('chat_attachments').select('*').eq('kind',kind).eq('reference',reference).order('created_at').order('id').range(page*500,page*500+499);
  if(result.error)throw new Error('Could not load the conversation attachments.');
  rows.push(...result.data);if(result.data.length<500)return rows;
 }
}
export async function sendChatMessage<T>(kind:ConversationKind,reference:string,id:string,body:string,files:File[]=[],internal=false):Promise<T&{attachments:ChatAttachment[]}>{
 if(files.length>CHAT_MAX_FILES)throw new Error('Attach up to three files per message.');
 const clean=body.trim()||(files.length?'Sent an attachment.':'');
 if(!clean)throw new Error('Write a message or attach a file.');
 const client=requireSupabase(),identity=await client.auth.getUser();
 if(identity.error||!identity.data.user)throw new Error('Sign in again before sending a message.');
 const owner=identity.data.user.id,table=kind==='request'?'transaction_messages':'concern_messages';
 const messageKey=kind==='request'?'request_message_id':'concern_message_id';
 const findSaved=async()=>{
  const result=await client.from(table).select('*').eq('id',id).maybeSingle();
  if(result.error)throw new Error('Could not confirm whether your message was saved. Keep your draft and retry when connected.');
  if(!result.data)return null;
  const row=result.data;
  if((kind==='request'?row.request_reference:row.reference)!==reference||row.author_id!==owner||row.body!==clean||(kind==='concern'&&row.internal!==internal))throw new Error('This message identifier was already used. Reload the conversation.');
  const attachments=(await readChatAttachments(kind,reference)).filter(item=>item[messageKey]===id);
  const actual=attachments.map(item=>`${item.file_name}:${item.file_size}`).sort(),expected=files.map(file=>`${file.name.trim()}:${file.size}`).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('The saved message has different attachments. Reload the conversation before sending another message.');
  return{...row,attachments} as T&{attachments:ChatAttachment[]};
 };
 const previous=await findSaved();if(previous)return previous;
 const uploads:{id:string;storage_path:string;file_name:string}[]=[];
 const cleanup=async()=>{if(!uploads.length)return;try{await client.storage.from('conversation-attachments').remove(uploads.map(item=>item.storage_path));}catch{/* Referenced files are protected by Storage policies; a draft can be retried. */}};
 try{
  for(const file of files){
   const checked=await validateChatFile(file),attachmentId=crypto.randomUUID(),path=`${owner}/${kind}/${id}/${attachmentId}.${checked.extension}`;
   uploads.push({id:attachmentId,storage_path:path,file_name:file.name.trim()});
   const uploaded=await client.storage.from('conversation-attachments').upload(path,file,{contentType:checked.mime,upsert:false});
   if(uploaded.error)throw new Error(`Could not upload ${file.name}. Your draft is still here.`);
  }
  const parameters:Record<string,unknown>={p_reference:reference,p_id:id,p_body:body.trim(),p_attachments:uploads};
  if(kind==='concern')parameters.p_internal=internal;
  const result=await client.rpc(kind==='request'?'send_transaction_message':'send_concern_message',parameters);
  if(result.error)throw new Error(result.error.message);
  const attachments=(await readChatAttachments(kind,reference)).filter(item=>item[messageKey]===id);
  return{...result.data,attachments} as T&{attachments:ChatAttachment[]};
 }catch(cause){
  try{const saved=await findSaved();if(saved){await cleanup();return saved;}}catch{/* Preserve the original failure and keep the stable draft identifier. */}
  await cleanup();throw cause;
 }
}
