export function validateBookingFields(form:{fullName:string;address:string;validIdType:string;validIdNumber:string;requestType:string;otherRequestType:string;purpose:string}){
 for(const [field,value,max,step,label]of [['fullName',form.fullName,200,1,'Full name'],['address',form.address,500,1,'Address'],['validIdNumber',form.validIdNumber,120,1,'ID number'],[form.requestType==='Other barangay document'?'otherRequestType':'requestType',form.requestType==='Other barangay document'?form.otherRequestType:form.requestType,200,2,'Document name'],['purpose',form.purpose,2000,2,'Purpose']] as const){if(!value.trim()||value.trim().length>max)return{field,message:`${label} is required and must be ${max} characters or fewer.`,step};}
 if(/[\x00-\x1f\x7f]/.test(form.validIdNumber))return{field:'validIdNumber',message:'ID number must not contain control characters.',step:1 as const};
 return null;
}
