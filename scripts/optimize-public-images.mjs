import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const profile=await fs.mkdtemp(path.join(process.env.TEMP??process.cwd(),'barangay-assets-'));
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket,launchError;chrome.on('error',error=>{launchError=error;});
try{
 let tab;for(let i=0;i<100&&!tab;i++){if(launchError)throw launchError;if(chrome.exitCode!==null)throw new Error('Chrome exited.');try{const port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];tab=(await(await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json()).find(item=>item.type==='page');}catch{}if(!tab)await new Promise(resolve=>setTimeout(resolve,100));}
 if(!tab)throw new Error('Browser launch timed out.');socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Connection timed out.')),10000);socket.onopen=()=>{clearTimeout(t);resolve();};socket.onerror=()=>{clearTimeout(t);reject(new Error('Connection failed.'));};});
 let next=0;const pending=new Map();socket.onmessage=event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result);}};
 for(const [source,target,size,quality]of [['public/banoy-chatbot.png','public/banoy-chatbot.webp',480,.86],['public/officials/brgylagasit.png','public/officials/brgylagasit.webp',384,.93]]){
  const data=await fs.readFile(source);
  const expression=`new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const ratio=Math.min(1,${size}/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);const c=canvas.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(img,0,0,canvas.width,canvas.height);resolve({width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/webp',${quality}).split(',')[1]});};img.onerror=()=>reject(new Error('Image decode failed.'));img.src=${JSON.stringify('data:image/png;base64,'+data.toString('base64'))};})`;
  const id=++next;const response=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Image conversion timed out.'));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});
  if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);const result=response.result.value,bytes=Buffer.from(result.data,'base64');await fs.writeFile(target,bytes);console.log(`${target}: ${result.width}x${result.height}, ${data.length} → ${bytes.length} bytes`);
 }
}finally{socket?.close();chrome.kill();}
