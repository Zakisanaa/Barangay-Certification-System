export function validateDocxArchive(buffer:ArrayBuffer):void {
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);
 const invalid=()=>{throw new Error('Choose a valid Word DOCX document containing its document and relationship files.');};
 if(bytes.length<22||bytes.length>5*1024*1024||view.getUint32(0,true)!==0x04034b50)invalid();
 let end=-1;
 for(let position=bytes.length-22;position>=Math.max(0,bytes.length-65557);position--){if(view.getUint32(position,true)===0x06054b50&&position+22+view.getUint16(position+20,true)===bytes.length){end=position;break;}}
 if(end<0)invalid();
 if(view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)invalid();
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true);let position=view.getUint32(end+16,true);
 if(count<3||count>2000||position+size>end||view.getUint16(end+8,true)!==count)invalid();
 const files=new Set<string>(),directoryEnd=position+size;
 for(let index=0;index<count;index++){
  if(position+46>directoryEnd||view.getUint32(position,true)!==0x02014b50)invalid();
  const nameLength=view.getUint16(position+28,true),extraLength=view.getUint16(position+30,true),commentLength=view.getUint16(position+32,true),next=position+46+nameLength+extraLength+commentLength;
  if(next>directoryEnd||(view.getUint16(position+8,true)&1)!==0)invalid();
  const name=new TextDecoder().decode(bytes.subarray(position+46,position+46+nameLength));
  if(name.split('/').includes('..')||name.startsWith('/')||name.includes('\\'))invalid();
  const local=view.getUint32(position+42,true),compressed=view.getUint32(position+20,true);
  if(local+30>view.getUint32(end+16,true)||view.getUint32(local,true)!==0x04034b50)invalid();
  if(local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true)+compressed>view.getUint32(end+16,true))invalid();
  files.add(name);position=next;
 }
 if(position!==directoryEnd||!['[Content_Types].xml','_rels/.rels','word/document.xml'].every(name=>files.has(name)))invalid();
}
