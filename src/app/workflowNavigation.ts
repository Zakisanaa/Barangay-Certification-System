export type WorkflowPage='admin'|'staff-payments'|'staff-register'|'staff-residents'|'staff-concerns'|'staff-queue'|'staff-settings';
export type WorkflowMode='record'|'history';
export type WorkflowTarget={reference:string;mode:WorkflowMode;token:string};
export type WorkflowNavigate=(page:WorkflowPage,reference?:string,mode?:WorkflowMode)=>void;
export interface OfficeTransaction {
 kind:'appointment'|'walk_in';id:string;reference:string;resident:string;service:string;service_key:string;
 status:string;archived:boolean;transaction_date:string;created_at:string;
 fee_amount:number|null;fee_description:string;fee_recorded:boolean;issued:boolean;
}
