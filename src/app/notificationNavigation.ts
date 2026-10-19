import type {StaffNotification} from './adminData';
import type {WorkflowPage,WorkflowMode} from './workflowNavigation';
export type PortalNotification=Pick<StaffNotification,'id'|'kind'|'reference'|'title'|'body'|'created_at'>&{permission?:StaffNotification['permission'];read:boolean};
export type ResidentNotificationPage='dashboard'|'concerns'|'profile'|'fees';
export function staffNotificationTarget(item:Pick<StaffNotification,'kind'|'permission'|'reference'>){
 const pages:Partial<Record<StaffNotification['permission'],WorkflowPage>>={requests:'admin',concerns:'staff-concerns',residents:'staff-residents',knowledge:'staff-banoy',payments:'staff-payments',certificates:'staff-register',settings:'staff-settings'};
 const page=item.kind==='closure'?'staff-queue':pages[item.permission];
 return page?{page,reference:item.reference??undefined,mode:(['payments','certificates'].includes(item.permission)?'history':'record') as WorkflowMode}:null;
}
export function residentNotificationTarget(item:Pick<PortalNotification,'kind'|'reference'>):{page:ResidentNotificationPage;reference?:string}{
 return {page:item.kind.startsWith('concern')?'concerns':item.kind==='verification'?'profile':item.kind==='fee_record'?'fees':'dashboard',reference:item.reference??undefined};
}
