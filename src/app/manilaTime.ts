export const OFFICE_TIME_ZONE='Asia/Manila';
export function manilaTime(value:string|number|Date,options:Intl.DateTimeFormatOptions={dateStyle:'medium',timeStyle:'short'}){const date=value instanceof Date?value:new Date(value);return Number.isNaN(date.getTime())?'Date unavailable':new Intl.DateTimeFormat('en-PH',{...options,timeZone:OFFICE_TIME_ZONE}).format(date);}
