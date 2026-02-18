const icons=["🍎","🎧","🔥","🚀","⭐","🔒","🔑","💎","🎯"];
let selected=[],AUTH_MODE="visual",SESSION_ID=null;

function shuffle(a){return a.sort(()=>Math.random()-0.5)}

fetch("/start-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:"U123"})})
.then(r=>r.json()).then(d=>{SESSION_ID=d.session_id;loadGrid(d.grid)})

function loadGrid(list){
  const g=document.getElementById("grid");
  g.innerHTML="";
  list.forEach(i=>{
    const d=document.createElement("div");
    d.className="cell";
    d.textContent=i;
    d.onclick=()=>select(i,d);
    g.appendChild(d);
  });
}

function select(i,e){
  if(selected.length<3&&!selected.includes(i)){
    selected.push(i);e.classList.add("selected");
    document.getElementById("s"+selected.length).textContent=i;
  }
}

document.getElementById("verify").onclick=()=>{
  fetch("/verify-auth",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({session_id:SESSION_ID,input:selected})})
  .then(r=>r.json()).then(d=>{
    document.getElementById("msg").textContent=d.result;
  });
}

// MODE SWITCH
["visual","fingerprint","face"].forEach(m=>{
  document.getElementById("mode-"+m).onclick=()=>switchMode(m)
});

function switchMode(m){
  AUTH_MODE=m;
  document.querySelectorAll(".mode").forEach(b=>b.classList.remove("active"));
  document.getElementById("mode-"+m).classList.add("active");

  document.getElementById("gridContainer").style.display=m==="visual"?"block":"none";
  if(m==="fingerprint") startBiometric();
  if(m==="face") startFace();
}

// BIOMETRIC
async function startBiometric(){
  if(!window.PublicKeyCredential)return alert("Not supported");
  try{
    await navigator.credentials.create({
      publicKey:{
        challenge:new Uint8Array(32),
        rp:{name:"Gateway"},
        user:{id:new Uint8Array(16),name:"demo",displayName:"Demo"},
        pubKeyCredParams:[{type:"public-key",alg:-7}]
      }
    });
    redirect();
  }catch{alert("Failed")}
}

// FACE
async function startFace(){
  const cam=document.getElementById("cam");
  const s=await navigator.mediaDevices.getUserMedia({video:true});
  cam.style.display="block";cam.srcObject=s;
  setTimeout(()=>{s.getTracks().forEach(t=>t.stop());cam.style.display="none";redirect()},4000);
}

function redirect(){
  window.location.href="https://bank.example.com?status=PASS";
}
