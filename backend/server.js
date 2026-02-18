const express=require("express");
const cors=require("cors");
const crypto=require("crypto");
const fs=require("fs");
const path=require("path");

const app=express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname,"../ui")));

const USERS = JSON.parse(fs.readFileSync("./users.json","utf-8"));
const sessions=new Map();
const hash=p=>crypto.createHash("sha256").update(p.join("|")).digest("hex");
const EMOJIS=["🍎","🎧","🔥","🚀","⭐","🔒","🔑","💎","🎯","⚡","🌙"];

function shuffle(a){return a.sort(()=>Math.random()-0.5)}

app.post("/start-auth",(req,res)=>{
  const {user_id}=req.body;
  const user=USERS[user_id];
  if(!user) return res.status(404).json({error:"USER_NOT_FOUND"});

  const sid=crypto.randomUUID();
  const grid=shuffle([...user.visual_secret,...EMOJIS.filter(e=>!user.visual_secret.includes(e)).slice(0,6)]);
  sessions.set(sid,{hash:hash(user.visual_secret),user:user_id});
  res.json({session_id:sid,grid});
});

app.post("/verify-auth",(req,res)=>{
  const {session_id,input}=req.body;
  const s=sessions.get(session_id);
  if(!s) return res.json({result:"FAIL"});

  const ok=hash(input)===s.hash;
  if(ok) sessions.delete(session_id);
  res.json({result:ok?"PASS":"FAIL"});
});

app.listen(3000,()=>console.log("Server running http://localhost:3000"));
