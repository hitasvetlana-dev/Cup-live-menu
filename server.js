const express=require('express');
const fs=require('fs');
const path=require('path');
const app=express();
const PORT=process.env.PORT||3000;
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const FILE=path.join(DATA_DIR,'menu.json');
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'cup2026';

app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));

function readDB(){return JSON.parse(fs.readFileSync(FILE,'utf8'))}
function writeDB(db){
 fs.mkdirSync(DATA_DIR,{recursive:true});
 const tmp=FILE+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(db,null,2),'utf8');
 fs.renameSync(tmp,FILE);
}
function auth(req,res,next){
 const p=req.get('x-admin-password');
 if(p!==ADMIN_PASSWORD) return res.status(401).json({error:'Неверный пароль'});
 next();
}
app.get('/api/menu',(req,res)=>res.json(readDB()));
app.put('/api/menu/:store',auth,(req,res)=>{
 const db=readDB(), key=req.params.store;
 if(!db[key]) return res.status(404).json({error:'Точка не найдена'});
 const items=Array.isArray(req.body.items)?req.body.items:[];
 db[key].items=items.slice(0,50).map(x=>({
   name:String(x.name||'').slice(0,80),
   price:Math.max(0,Number(x.price)||0),
   show:Boolean(x.show)
 }));
 writeDB(db); res.json({ok:true});
});
app.get('/health',(req,res)=>res.send('ok'));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/screen',(req,res)=>res.sendFile(path.join(__dirname,'public','screen.html')));
app.listen(PORT,'0.0.0.0',()=>console.log('CUP menu on port '+PORT));