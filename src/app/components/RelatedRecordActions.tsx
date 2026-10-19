import {canManage} from '../access';
import type {ResidentAccount} from '../residentAuth';
import type {WorkflowNavigate,WorkflowPage} from '../workflowNavigation';

export default function RelatedRecordActions({entity,recordId,data,account,onNavigate}:{entity:string;recordId?:string;data:Record<string,unknown>;account:ResidentAccount;onNavigate:WorkflowNavigate}){
 const actions:{page:WorkflowPage;reference:string;label:string;history?:boolean}[]=[];
 const value=(key:string)=>typeof data[key]==='string'?data[key] as string:undefined;
 const reference=value('reference')??recordId;
 if((entity==='requests'||entity==='appointment_requests')&&reference&&(canManage(account,'requests')||canManage(account,'certificates')))actions.push({page:'admin',reference,label:'Open request'});
 if((entity==='concerns'||entity==='resident_concerns')&&reference&&canManage(account,'concerns'))actions.push({page:'staff-concerns',reference,label:'Open concern'});
 if((entity==='resident_profiles'||entity==='resident_verifications')&&canManage(account,'residents')){const id=entity==='resident_profiles'?(value('id')??recordId):value('resident_id');if(id)actions.push({page:'staff-residents',reference:id,label:'Review resident verification'});}
 const transaction=value('request_reference')??value('walk_in_id')??((entity==='walk_ins'||entity==='walk_in_transactions')?reference:undefined);
 if(transaction){
  if(canManage(account,'payments'))actions.push({page:'staff-payments',reference:transaction,label:entity==='fees'||entity==='fee_records'?'Open fee history':'Fees & receipts',history:entity==='fees'||entity==='fee_records'});
  if(canManage(account,'certificates'))actions.push({page:'staff-register',reference:transaction,label:entity==='certificates'||entity==='certificate_register'?'Open issuance history':'Certificate register',history:entity==='certificates'||entity==='certificate_register'});
 }
 if(!actions.length)return null;
 return <div className="flex flex-wrap gap-2">{actions.map(action=><button key={action.page} type="button" className="min-h-11 rounded border border-[#c9d1ca] px-3 text-sm font-semibold" onClick={()=>onNavigate(action.page,action.reference,action.history?'history':'record')}>{action.label}</button>)}</div>;
}
