import {useEffect,useRef} from 'react';
const drafts=new Set<()=>boolean>();
export function confirmDiscardChanges(){return ![...drafts].some(check=>check())||window.confirm('Discard your unsaved changes?');}
export function useUnsavedChanges(dirty:boolean){const current=useRef(dirty);current.current=dirty;useEffect(()=>{const check=()=>current.current;drafts.add(check);const beforeUnload=(event:BeforeUnloadEvent)=>{if(check()){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);return()=>{drafts.delete(check);window.removeEventListener('beforeunload',beforeUnload);};},[]);}
