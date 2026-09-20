const express=require('express');
const fs=require('fs');
const path=require('path');
const app=express();
const PORT=process.env.PORT||3000;
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'cup2026';
const STORES={
'leninsk':'Ленинск-Кузнецкий',
'yurga-stroitelnaya':'Юрга — Строительная',
'yurga-kirpichnaya':'Юрга — Кирпичная',
'taiga':'Тайга','yashkino':'Яшкино','luna':'Луна'};
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));
const valid=id=>Object.prototype.hasOwnProperty.call(STORES,id);
const file=id=>path.join(DATA_DIR,`menu-${id}.json`);
function readDB(id){try{return JSON.parse(fs.readFileSync(file(id),'utf8'))}catch(e){return{title:'ПИВО НА КРАНАХ',store:STORES[id],items:[]}}}
function writeDB(id,db){fs.mkdirSync(DATA_DIR,{recursive:true});const f=file(id),t=f+'.tmp';fs.writeFileSync(t,JSON.stringify(db,null,2),'utf8');fs.renameSync(t,f)}
function auth(req,res,next){if(req.get('x-admin-password')!==ADMIN_PASSWORD)return res.status(401).json({error:'Неверный пароль'});next()}
app.get('/api/menu/:store',(req,res)=>{if(!valid(req.params.store))return res.status(404).json({error:'Точка не найдена'});res.json(readDB(req.params.store))});
app.put('/api/menu/:store',auth,(req,res)=>{const id=req.params.store;if(!valid(id))return res.status(404).json({error:'Точка не найдена'});
const incoming=Array.isArray(req.body.items)?req.body.items:[];
const items=incoming.slice(0,50).map(x=>({name:String(x.name||'').trim().slice(0,80),price:Math.max(0,Number(x.price)||0),status:['sale','way','hidden'].includes(x.status)?x.status:'sale',new:Boolean(x.new)}));
const db={title:'ПИВО НА КРАНАХ',store:STORES[id],items};writeDB(id,db);res.json({ok:true,items})});
app.get('/health',(req,res)=>res.send('OK'));
app.get('/screen/:store',(req,res)=>valid(req.params.store)?res.sendFile(path.join(__dirname,'public','index.html')):res.status(404).send('Точка не найдена'));
app.get('/admin/:store',(req,res)=>valid(req.params.store)?res.sendFile(path.join(__dirname,'public','admin.html')):res.status(404).send('Точка не найдена'));
app.get('/',(req,res)=>res.redirect('/screen/leninsk'));
app.listen(PORT,'0.0.0.0',()=>console.log(`ЦУП запущен на порту ${PORT}`));
