import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDocxArchive} from '../src/app/documentFiles.ts';
import {createDocxArchive} from './fixtures/docx-archive.js';
test('template uploads require a complete DOCX ZIP directory and document parts',()=>{
 const buffer=createDocxArchive();assert.doesNotThrow(()=>validateDocxArchive(buffer));
 assert.throws(()=>validateDocxArchive(new TextEncoder().encode('PKnot-a-DOCX').buffer),/valid Word DOCX/);
 const broken=buffer.slice(0);new DataView(broken).setUint32(broken.byteLength-6,0xffffffff,true);assert.throws(()=>validateDocxArchive(broken),/valid Word DOCX/);
 const missing=buffer.slice(0),bytes=new Uint8Array(missing);const name=new TextEncoder().encode('word/document.xml');for(let position=0;position<bytes.length-name.length;position++){if(name.every((value,index)=>bytes[position+index]===value))bytes[position]=120;}assert.throws(()=>validateDocxArchive(missing),/valid Word DOCX/);
});
