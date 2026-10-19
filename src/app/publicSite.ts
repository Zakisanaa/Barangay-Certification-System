import { useEffect,useState } from 'react';
import { requireSupabase,isSupabaseConfigured } from './supabase';
import { publicAsset } from './publicAsset';
import { subscribeAdminTables } from './adminData';
import type { LeadershipImage,Official,PublicStatement,SiteContent } from './adminData';
export const defaultLeadership:LeadershipImage={image:'officials/group photo.jpg',alt:'Barangay Lagasit officials'};
export const defaultOfficials:Official[]=[
  {
    name: "Punong Barangay Perlita Lugares",
    role: "Punong Barangay",
    image: "officials/Punong Barangay Perlita Lugares.jpg",
  },
  {
    name: "Brgy. Kgwd. Errol Julian",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Errol Julian.jpg",
  },
  {
    name: "Brgy. Kgwd. Ramil Villar",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Ramil Villar.jpg",
  },
  {
    name: "Brgy. Kgwd. Rodrigo Aquino III",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Rodrigo Aquino III.jpg",
  },
  {
    name: "Brgy. Kgwd. Amado Hidalgo",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Amado Hidalgo.jpg",
  },
  {
    name: "Brgy. Kgwd. Felipe Ogaco",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Felipe Ogaco.jpg",
  },
  {
    name: "Brgy. Kgwd. Ricky Carmesis",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Ricky Carmesis.jpg",
  },
  {
    name: "Bry. Kgwd. Rodillo Aloot",
    role: "Barangay Kagawad",
    image: "officials/Bry. Kgwd. Rodillo Aloot.jpg",
  },
  {
    name: "Brgy Secretary Meka Ella Arandia",
    role: "Barangay Secretary",
    image: "officials/Brgy Secretary Meka Ella Arandia.jpg",
  },
  {
    name: "Barangay Treasurer Janelyn Pajarit",
    role: "Barangay Treasurer",
    image: "officials/Brgy. Treasurer Janelyn Pajarit.jpg",
  },
  {
    name: "SK Chairman Vannrexsir Peralta",
    role: "SK Chairman",
    image: "officials/SK Chairman Vannrexsir Peralta.jpg",
  },
];
export const defaultPublicText={
 about:'Barangay Lagasit provides accessible government services, efficient appointment processing, and timely public updates to strengthen the welfare of the community.',
 mission:'To provide responsive, fair, and accessible public service that supports the safety, welfare, and growth of every Barangay Lagasit resident.',
 vision:'A peaceful, inclusive, and progressive barangay where residents can access trusted services and take part in community development.',
};
export function getOfficialImageUrl(path:string){if(!path)return '';return path.startsWith('official-images/')?requireSupabase().storage.from('official-images').getPublicUrl(path.slice('official-images/'.length)).data.publicUrl:publicAsset(path);}
export function getPublicStatement(value:SiteContent['value']|undefined,fallback:string):PublicStatement{
 if(value&&typeof value==='object'&&!Array.isArray(value)&&'text' in value)return value;
 return {text:typeof value==='string'?value:fallback,image:'',alt:''};
}
export function usePublicSiteContent(){
 const [records,setRecords]=useState<SiteContent[]>([]);
 useEffect(()=>{if(!isSupabaseConfigured)return;let alive=true;const load=async()=>{try{const {data,error}=await requireSupabase().from('site_content').select('*');if(error)throw error;if(alive)setRecords(data);}catch{console.error('Could not refresh public site content.');}};void load();const unsubscribe=subscribeAdminTables(['site_content'],()=>void load());return()=>{alive=false;unsubscribe();};},[]);
 const get=(key:string)=>records.find(item=>item.key===key);
 return {records,leadership:(get('leadership')?.value as LeadershipImage|undefined)??defaultLeadership,officials:(get('officials')?.value as Official[]|undefined)??defaultOfficials,about:(get('about')?.value as string|undefined)??defaultPublicText.about,mission:getPublicStatement(get('mission')?.value,defaultPublicText.mission),vision:getPublicStatement(get('vision')?.value,defaultPublicText.vision),missionPublished:!!get('mission'),visionPublished:!!get('vision')};
}

