export function formatServiceFee(service: {fee_amount?:number|null;fee_description:string}) {
 const amount=service.fee_amount;
 const fee=amount==null?'Confirm the fee with the barangay office.':Number(amount)===0?'Free (no fee)':`PHP ${Number(amount).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 return amount==null&&service.fee_description?service.fee_description:service.fee_description?`${fee} · ${service.fee_description}`:fee;
}
