'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LearnCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const VERSION=1,KEY='imagina.learn.v1';
 const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const addDays=(date,n)=>{const [y,m,d]=date.split('-').map(Number);return day(new Date(y,m-1,d+n,12));};
 const validDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&day(new Date(x+'T12:00:00'))===x;
 const number=(n,max=100000)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
 const text=(s,max=24)=>typeof s==='string'?s.replace(/[<>\x00-\x1f]/g,'').trim().slice(0,max):'';
 const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 function profile(name='Explorador',id=uid()){return{id,name,companion:'milo',settings:{mode:'listen',size:4,speed:1,translation:true,sound:true,motion:!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches},words:{},sessions:[],stars:0,stickers:[],weekly:[],created:day()};}
 function fresh(){const p=profile();return{version:VERSION,active:p.id,profiles:[p]};}
 function clean(raw,ids){
  if(!raw||raw.version!==VERSION||!Array.isArray(raw.profiles)||!raw.profiles.length||raw.profiles.length>4)throw Error('El archivo no es un respaldo de IMAGINA Learn.');
  const known=new Set(ids),seenIds=new Set();
  const profiles=raw.profiles.map(p=>{
   if(!p||typeof p!=='object')throw Error('Perfil inválido.');
   const id=text(p.id,60)||uid();if(seenIds.has(id))throw Error('Perfiles duplicados.');seenIds.add(id);
   const out=profile(text(p.name)||'Explorador',id),s=p.settings||{};
   out.companion=p.companion==='lumi'?'lumi':'milo';out.created=validDay(p.created)?p.created:day();
   out.settings={mode:['listen','letters','write'].includes(s.mode)?s.mode:'listen',size:[4,6,8].includes(s.size)?s.size:4,speed:[.75,1].includes(s.speed)?s.speed:1,translation:s.translation!==false,sound:s.sound!==false,motion:s.motion!==false};
   for(const [k,w]of Object.entries(p.words||{})){if(!known.has(k)||!w||typeof w!=='object')continue;out.words[k]={seen:number(w.seen),attempts:number(w.attempts),correct:Math.min(number(w.correct),number(w.attempts)),stage:number(w.stage,4),due:validDay(w.due)?w.due:day(),last:validDay(w.last)?w.last:'',stageDay:validDay(w.stageDay)?w.stageDay:''};}
   out.sessions=(Array.isArray(p.sessions)?p.sessions:[]).slice(-200).filter(x=>x&&validDay(x.date)).map(x=>({id:text(x.id,80),date:x.date,mode:['lesson','review','weekly','practice'].includes(x.mode)?x.mode:'lesson',attempts:number(x.attempts,96),correct:Math.min(number(x.correct,96),number(x.attempts,96)),assisted:number(x.assisted,96),words:[...new Set((Array.isArray(x.words)?x.words:[]).filter(w=>known.has(w)))].slice(0,96)}));
   out.stars=number(p.stars);out.stickers=[...new Set((Array.isArray(p.stickers)?p.stickers:[]).filter(x=>typeof x==='string'&&/^[a-z-]+$/.test(x)))].slice(0,12);
   out.weekly=(Array.isArray(p.weekly)?p.weekly:[]).filter(x=>x&&validDay(x.date)).slice(-52).map(x=>({date:x.date,correct:number(x.correct,10),total:Math.max(1,number(x.total,10))}));
   return out;
  });
  return{version:VERSION,active:profiles.some(p=>p.id===raw.active)?raw.active:profiles[0].id,profiles};
 }
 function chooseWords(p,words,{category=null,size=p.settings.size,review=false,today=day()}={}){
  const list=words.filter(w=>(!category||w.category===category)&&(!review||p.words[w.id]?.attempts));
  return [...list].sort((a,b)=>{const x=p.words[a.id],y=p.words[b.id];const rank=v=>v?.attempts&&v.due<=today?0:!v?.attempts?1:2;return rank(x)-rank(y)||(x?.due||today).localeCompare(y?.due||today)||(x?.stage||0)-(y?.stage||0);}).slice(0,size);
 }
 function record(p,id,{correct,assisted=false,today=day()}){
  const w=p.words[id]||{seen:0,attempts:0,correct:0,stage:0,due:today,last:'',stageDay:''};
  w.attempts++;if(correct&&!assisted)w.correct++;
  if(correct&&!assisted){if(w.stageDay!==today){w.stage=Math.min(4,w.stage+1);w.stageDay=today;w.due=addDays(today,[1,1,3,7,14][w.stage]);}}
  else{w.stage=0;w.due=addDays(today,1);w.stageDay=today;}
  w.last=today;p.words[id]=w;return w;
 }
 function complete(p,s,today=day()){
  if(p.sessions.some(x=>x.id===s.id))return 0;
  const practiced=new Set(p.sessions.filter(x=>x.date===today).flatMap(x=>x.words));
  const unique=[...new Set(s.words)],earned=unique.filter(id=>!practiced.has(id)).length;
  p.sessions.push({...s,words:unique,date:today});p.sessions=p.sessions.slice(-200);p.stars+=earned;
  return earned;
 }
 function weeklyReady(p,today=day()){const last=p.weekly.at(-1);return !last||addDays(last.date,7)<=today;}
 function stats(p,today=day()){
  const words=Object.values(p.words),attempts=p.sessions.reduce((n,s)=>n+s.attempts,0),correct=p.sessions.reduce((n,s)=>n+s.correct,0);
  return{seen:words.filter(w=>w.seen||w.attempts).length,practiced:words.filter(w=>w.attempts).length,steady:words.filter(w=>w.stage>=3).length,due:words.filter(w=>w.attempts&&w.due<=today).length,attempts,correct,accuracy:attempts?Math.round(correct/attempts*100):null,today:p.sessions.filter(s=>s.date===today).length,days:new Set(p.sessions.map(s=>s.date)).size};
 }
 const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 const shuffle=(a,rng=Math.random)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
 return{VERSION,KEY,day,addDays,validDay,uid,text,profile,fresh,clean,chooseWords,record,complete,weeklyReady,stats,normalize,shuffle};
});
