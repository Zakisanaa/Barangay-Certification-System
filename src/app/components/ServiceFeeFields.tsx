import ChoiceOrCustom from './ChoiceOrCustom';
import {workflowField as field} from './AdminWorkflowUi';

export default function ServiceFeeFields({amount,description,onChange,disabled=false}:{amount?:number|null;description:string;onChange:(amount:number|null,description:string)=>void;disabled?:boolean}) {
 return <fieldset className="min-w-0 space-y-3 rounded border border-[#c9d1ca] bg-[#f7faf7] p-4" disabled={disabled}>
  <legend className="px-1 font-bold">Service fee</legend>
  <label className="grid gap-1 text-sm font-semibold">Fee amount (PHP)<input type="number" min="0" max="9999999999.99" step="0.01" value={amount??''} onChange={event=>onChange(event.target.value===''?null:Number(event.target.value),description)} className={field} placeholder="Enter the approved amount"/><span className="text-xs font-normal text-[#53645b]">Enter 0 for a free service. Leave blank when the office has not confirmed the amount.</span></label>
  <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded border bg-white px-3 text-sm font-semibold" onClick={()=>onChange(0,'')}>Set as free</button><button type="button" className="min-h-11 rounded border bg-white px-3 text-sm font-semibold" onClick={()=>onChange(null,'Confirm the fee with the barangay office before paying.')}>Confirm with office</button></div>
  <p className="text-xs text-[#53645b]">Use the amount field for the fee. Use payment instructions for when and how residents should pay.</p>
  <ChoiceOrCustom label="Verified fee or payment instructions" value={description} onChange={value=>onChange(amount??null,value)} choices={['Pay at the barangay office.','Pay after your request is approved.','Bring your official receipt when claiming the document.','Confirm any exemption with the barangay office.']} maxLength={1000} disabled={disabled}/>
 </fieldset>;
}
