import { useState, useEffect, useRef, useCallback } from "react";

/* ════════════════════════════════════════════
   CENSURAY v6 — Real Supabase Auth
   ════════════════════════════════════════════ */

// ── Supabase Client (inline, no npm needed in artifact) ──
const SUPABASE_URL = "https://fjdqpqggbtvjmoccnnib.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZHFwcWdnYnR2am1vY2NubmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTgwNDIsImV4cCI6MjA5MTc3NDA0Mn0.7SueogNOy9a8Ocy6uVm5a3KT72WUorXw50Riscacn8M";

// Lightweight Supabase client wrapper (no SDK needed)
const supabase = {
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${supabase._accessToken || SUPABASE_ANON_KEY}`,
  }),
  _accessToken: null,
  _user: null,
  _listeners: [],

  async signUp(email, password, displayName) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: { display_name: displayName } }),
    });
    const data = await res.json();
    if (data.error || data.msg) throw new Error(data.error?.message || data.msg || "Error al registrar");
    if (data.access_token) {
      supabase._accessToken = data.access_token;
      supabase._user = data.user;
      localStorage.setItem("sb_access_token", data.access_token);
      localStorage.setItem("sb_refresh_token", data.refresh_token);
      supabase._notify(data.user);
    }
    return data;
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.error || data.error_description) throw new Error(data.error_description || data.error?.message || "Credenciales inválidas");
    supabase._accessToken = data.access_token;
    supabase._user = data.user;
    localStorage.setItem("sb_access_token", data.access_token);
    localStorage.setItem("sb_refresh_token", data.refresh_token);
    supabase._notify(data.user);
    return data;
  },

  async resetPassword(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Error"); }
  },

  signInWithGoogle() {
    const redirectTo = window.location.origin + window.location.pathname;
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  },

  async signOut() {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: supabase.headers(),
      });
    } catch(e) {}
    supabase._accessToken = null;
    supabase._user = null;
    localStorage.removeItem("sb_access_token");
    localStorage.removeItem("sb_refresh_token");
    supabase._notify(null);
  },

  async getUser() {
    const token = supabase._accessToken || localStorage.getItem("sb_access_token");
    if (!token) return null;
    supabase._accessToken = token;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) { supabase._accessToken = null; localStorage.removeItem("sb_access_token"); return null; }
      const user = await res.json();
      supabase._user = user;
      return user;
    } catch(e) { return null; }
  },

  async refreshSession() {
    const rt = localStorage.getItem("sb_refresh_token");
    if (!rt) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      supabase._accessToken = data.access_token;
      supabase._user = data.user;
      localStorage.setItem("sb_access_token", data.access_token);
      localStorage.setItem("sb_refresh_token", data.refresh_token);
      return data.user;
    } catch(e) { return null; }
  },

  // DB queries
  async query(table, { select = "*", eq, single } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
    if (eq) Object.entries(eq).forEach(([k, v]) => url += `&${k}=eq.${v}`);
    const res = await fetch(url, { headers: supabase.headers() });
    const data = await res.json();
    return single ? data[0] : data;
  },

  onAuthChange(fn) { supabase._listeners.push(fn); return () => { supabase._listeners = supabase._listeners.filter(f => f !== fn); }; },
  _notify(user) { supabase._listeners.forEach(fn => fn(user)); },
};

// ── Handle OAuth redirect (tokens in URL hash) ──
function handleOAuthRedirect() {
  const hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    const at = params.get("access_token");
    const rt = params.get("refresh_token");
    if (at) {
      supabase._accessToken = at;
      localStorage.setItem("sb_access_token", at);
      if (rt) localStorage.setItem("sb_refresh_token", rt);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
}

/* ── Palette ── */
const P = {
  light: {
    bg:"#F7F5F2",bgAlt:"#EFECE8",surface:"#FFFFFF",surfaceHov:"#FAFAF8",
    text:"#1C1917",textSoft:"#78716C",textFaint:"#A8A29E",
    accent:"#6D28D9",accentSoft:"#8B5CF6",accentMist:"rgba(109,40,217,0.06)",accentGlow:"rgba(109,40,217,0.12)",
    ok:"#059669",okBg:"#ECFDF5",warn:"#D97706",warnBg:"#FFFBEB",err:"#DC2626",errBg:"#FEF2F2",
    border:"#E7E5E4",shadow1:"0 1px 2px rgba(28,25,23,0.04)",shadow2:"0 4px 24px rgba(28,25,23,0.06),0 1px 3px rgba(28,25,23,0.04)",shadow3:"0 12px 48px rgba(109,40,217,0.08),0 4px 16px rgba(28,25,23,0.04)",
    toggleOff:"#D6D3D1",toggleOn:"#6D28D9",
  },
  dark: {
    bg:"#0C0A09",bgAlt:"#1C1917",surface:"#171412",surfaceHov:"#1E1A17",
    text:"#F5F5F4",textSoft:"#A8A29E",textFaint:"#57534E",
    accent:"#A78BFA",accentSoft:"#C4B5FD",accentMist:"rgba(167,139,250,0.08)",accentGlow:"rgba(167,139,250,0.15)",
    ok:"#34D399",okBg:"#052E16",warn:"#FBBF24",warnBg:"#2D2005",err:"#F87171",errBg:"#2D0808",
    border:"#292524",shadow1:"0 1px 2px rgba(0,0,0,0.2)",shadow2:"0 4px 24px rgba(0,0,0,0.25)",shadow3:"0 12px 48px rgba(167,139,250,0.1),0 4px 16px rgba(0,0,0,0.3)",
    toggleOff:"#44403C",toggleOn:"#A78BFA",
  },
};

const PLAN_META = { free:{name:"Free",price:"$0"}, pro:{name:"Pro",price:"$10/mes"}, business:{name:"Business",price:"$25/mes"} };

const DEFAULT_FEATURES = {
  max_minutes_per_day:{enabled:true,limit_value:30}, max_file_size_mb:{enabled:true,limit_value:100},
  category_profanity:{enabled:true}, category_names:{enabled:false}, category_personal_data:{enabled:false}, category_brands:{enabled:false},
  custom_keywords:{enabled:false}, custom_replacement_sound:{enabled:false}, sensitivity_levels:{enabled:false},
  batch_processing:{enabled:false}, priority_processing:{enabled:false}, export_video:{enabled:false}, api_access:{enabled:false},
};

const CATEGORIES = [
  { id:"profanity",label:"Groserías y vulgaridades",desc:"Malas palabras, insultos y lenguaje soez",icon:"🤬",featureKey:"category_profanity" },
  { id:"names",label:"Nombres propios",desc:"Nombres de personas mencionadas",icon:"👤",featureKey:"category_names" },
  { id:"personal",label:"Datos personales",desc:"Teléfonos, direcciones, emails, cuentas",icon:"🔒",featureKey:"category_personal_data" },
  { id:"brands",label:"Marcas y empresas",desc:"Compañías, productos, marcas registradas",icon:"🏢",featureKey:"category_brands" },
];

const SOUNDS = [
  { id:"bleep",label:"Bleep",desc:"Tono clásico 1kHz",icon:"◉",requiresPro:false },
  { id:"silence",label:"Silencio",desc:"Mute total",icon:"○",requiresPro:false },
  { id:"sfx",label:"Efecto sonoro",desc:"Bocina, risa, cartoon",icon:"◈",requiresPro:false },
  { id:"custom",label:"Tu audio",desc:"Sube tu propio sonido",icon:"◆",requiresPro:true },
];

const SENSITIVITY = [{id:"low",label:"Baja",desc:"Solo groserías explícitas"},{id:"medium",label:"Media",desc:"Groserías + expresiones fuertes"},{id:"high",label:"Alta",desc:"Todo lenguaje potencialmente ofensivo"}];

const MOCK_DETECTIONS = [
  {id:1,word:"maldito",time:142.5,timeStr:"2:22",cat:"profanity",context:"…el problema es que este",contextAfter:"sistema no funciona…",censored:true},
  {id:2,word:"madre",time:387.9,timeStr:"6:27",cat:"profanity",context:"…me tiene hasta la",contextAfter:", o sea literal…",censored:true},
  {id:3,word:"porquería",time:734.2,timeStr:"12:14",cat:"profanity",context:"…todo esto es una",contextAfter:"y que no piensa pagar…",censored:true},
  {id:4,word:"carajo",time:856.1,timeStr:"14:16",cat:"profanity",context:"…no va a pagar ni un",contextAfter:". Eso fue lo que dijo…",censored:true},
  {id:5,word:"Juan Pérez",time:528.3,timeStr:"8:48",cat:"names",context:"…el cliente",contextAfter:"llamó otra vez…",censored:true},
  {id:6,word:"Juan Pérez",time:1847.6,timeStr:"30:47",cat:"names",context:"…entonces le dije a",contextAfter:"que tenía que calmarse…",censored:true},
  {id:7,word:"Acme Corp",time:612.7,timeStr:"10:12",cat:"brands",context:"…trabaja en",contextAfter:"desde hace cinco años…",censored:true},
  {id:8,word:"mierda",time:1523.8,timeStr:"25:23",cat:"profanity",context:"…dijo que todo era una",contextAfter:"y que iba a cancelar…",censored:true},
  {id:9,word:"pendejo",time:2105.3,timeStr:"35:05",cat:"profanity",context:"…no seas",contextAfter:", hay que pensar bien…",censored:true},
  {id:10,word:"55-1234-5678",time:3580.2,timeStr:"59:40",cat:"personal",context:"…me puedes llamar al",contextAfter:"cuando quieras…",censored:true},
  {id:11,word:"cabrón",time:4012.7,timeStr:"1:06:52",cat:"profanity",context:"…ese",contextAfter:"no entiende nada…",censored:true},
  {id:12,word:"verga",time:4780.9,timeStr:"1:19:40",cat:"profanity",context:"…me vale",contextAfter:", yo ya hice mi parte…",censored:true},
];

/* ── Small Components ── */
function Toggle({on,onChange,c,disabled}){return(<button onClick={disabled?undefined:onChange} style={{width:44,height:24,borderRadius:12,border:"none",cursor:disabled?"not-allowed":"pointer",background:on?c.toggleOn:c.toggleOff,position:"relative",transition:"background .2s",flexShrink:0,opacity:disabled?.4:1}}><span style={{width:18,height:18,borderRadius:9,background:"#FFF",position:"absolute",top:3,left:on?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.15)"}}/></button>)}
function PlanBadge({plan,c}){return(<span style={{fontFamily:"var(--font-mono)",fontSize:9,padding:"3px 8px",borderRadius:4,background:plan==="pro"?c.accentMist:c.warnBg,color:plan==="pro"?c.accent:c.warn,letterSpacing:".05em",textTransform:"uppercase",fontWeight:600}}>{PLAN_META[plan]?.name}</span>)}
function LoaderBars({c}){return(<div style={{display:"flex",alignItems:"center",gap:3,height:32}}>{[0,1,2,3,4].map(i=><div key={i} style={{width:3,borderRadius:2,background:c.accent,animation:`barPulse 1s ease-in-out ${i*.12}s infinite`}}/>)}</div>)}
function Section({title,subtitle,children,c,delay=0}){return(<div style={{background:c.surface,borderRadius:14,border:`1px solid ${c.border}`,boxShadow:c.shadow1,padding:24,marginBottom:12,animation:`enterUp .5s cubic-bezier(.16,1,.3,1) ${delay}s both`}}>{title&&<div style={{marginBottom:subtitle?4:16}}><h3 style={{fontFamily:"var(--font-body)",fontSize:15,fontWeight:600}}>{title}</h3>{subtitle&&<p style={{fontFamily:"var(--font-body)",fontSize:12,color:c.textFaint,fontWeight:300,marginTop:2,marginBottom:16}}>{subtitle}</p>}</div>}{children}</div>)}
function KeywordTag({word,onRemove,c}){return(<span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 10px 5px 12px",borderRadius:8,background:c.accentMist,border:`1px solid ${c.accent}22`,fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,color:c.accent}}>{word}<button onClick={onRemove} style={{width:18,height:18,borderRadius:4,border:"none",background:"transparent",color:c.accent,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button></span>)}

function DetectionRow({det,onToggle,onPlay,playing,c}){
  const [hov,setHov]=useState(false);
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:10,background:hov?c.surfaceHov:"transparent",borderBottom:`1px solid ${c.border}`,opacity:det.censored?1:.55}}>
      <button onClick={onPlay} style={{minWidth:68,padding:"6px 10px",borderRadius:8,border:"none",background:playing?c.accent:c.bgAlt,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10,color:playing?"#FFF":c.accent,fontFamily:"var(--font-mono)"}}>{playing?"◼":"▶"}</span>
        <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:500,color:playing?"#FFF":c.text}}>{det.timeStr}</span>
      </button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
          <span style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:600,color:det.censored?c.accent:c.textSoft,textDecoration:det.censored?"line-through":"none"}}>{det.word}</span>
          <span style={{fontFamily:"var(--font-mono)",fontSize:9,padding:"2px 6px",borderRadius:4,background:c.accentMist,color:c.accent,textTransform:"uppercase"}}>{det.cat}</span>
        </div>
        <p style={{fontFamily:"var(--font-body)",fontSize:12,color:c.textFaint,fontWeight:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{det.context} <strong style={{color:det.censored?c.accent:c.textSoft,fontWeight:600}}>{det.word}</strong> {det.contextAfter}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <Toggle on={det.censored} onChange={onToggle} c={c}/>
        <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:c.textFaint}}>{det.censored?"censurado":"original"}</span>
      </div>
    </div>
  );
}

function AuthInput({label,type,value,onChange,c,placeholder,error}){
  return(<div style={{marginBottom:16}}>
    <label style={{fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,color:c.text,display:"block",marginBottom:6}}>{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${error?c.err:c.border}`,background:c.bgAlt,fontFamily:"var(--font-body)",fontSize:14,color:c.text,outline:"none",transition:"border .2s"}} onFocus={e=>e.target.style.borderColor=c.accent} onBlur={e=>e.target.style.borderColor=error?c.err:c.border}/>
    {error&&<p style={{fontFamily:"var(--font-body)",fontSize:12,color:c.err,marginTop:4}}>{error}</p>}
  </div>);
}

/* ════ MAIN ════ */
export default function Censuray(){
  const [dark,setDark]=useState(true);
  const [view,setView]=useState("loading");
  const [user,setUser]=useState(null);
  const [userPlan,setUserPlan]=useState("free");
  const [features,setFeatures]=useState(DEFAULT_FEATURES);
  const [userMenu,setUserMenu]=useState(false);

  const [authMode,setAuthMode]=useState("login");
  const [authEmail,setAuthEmail]=useState("");
  const [authPass,setAuthPass]=useState("");
  const [authName,setAuthName]=useState("");
  const [authError,setAuthError]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [authSuccess,setAuthSuccess]=useState("");

  const [file,setFile]=useState("");
  const [fileSize,setFileSize]=useState("");
  const [drag,setDrag]=useState(false);
  const [familyFriendly,setFamilyFriendly]=useState(true);
  const [cats,setCats]=useState({profanity:true,names:false,personal:false,brands:false});
  const [sensitivity,setSensitivity]=useState("medium");
  const [sound,setSound]=useState("bleep");
  const [keywords,setKeywords]=useState([]);
  const [kwInput,setKwInput]=useState("");
  const [padding,setPadding]=useState(50);
  const [preserveVideo,setPreserveVideo]=useState(true);
  const [autoDetectLang,setAutoDetectLang]=useState(true);
  const [progress,setProgress]=useState(0);
  const [processingPhase,setProcessingPhase]=useState("");
  const [detections,setDetections]=useState([]);
  const [playingId,setPlayingId]=useState(null);
  const [filterCat,setFilterCat]=useState("all");
  const [searchDet,setSearchDet]=useState("");

  const c=dark?P.dark:P.light;

  // Feature check helper
  const canUse=(key)=>features[key]?.enabled;
  const getLimit=(key)=>features[key]?.limit_value;

  // Load features from DB
  const loadFeatures=async(planId)=>{
    try{
      const data=await supabase.query("plan_features",{select:"feature_key,enabled,limit_value",eq:{plan_id:planId}});
      if(data&&Array.isArray(data)){
        const map={};
        data.forEach(f=>map[f.feature_key]={enabled:f.enabled,limit_value:f.limit_value});
        setFeatures(map);
      }
    }catch(e){console.error("Failed to load features",e);}
  };

  // Load user subscription
  const loadUserPlan=async(userId)=>{
    try{
      const sub=await supabase.query("subscriptions",{select:"plan_id",eq:{user_id:userId,status:"active"},single:true});
      if(sub?.plan_id){setUserPlan(sub.plan_id);await loadFeatures(sub.plan_id);}
      else{setUserPlan("free");await loadFeatures("free");}
    }catch(e){setUserPlan("free");loadFeatures("free");}
  };

  // Init: check session
  useEffect(()=>{
    handleOAuthRedirect();
    (async()=>{
      let u=await supabase.getUser();
      if(!u) u=await supabase.refreshSession();
      if(u){setUser(u);await loadUserPlan(u.id);setView("home");}
      else{setView("home");}
    })();
    const unsub=supabase.onAuthChange(async(u)=>{
      setUser(u);
      if(u){await loadUserPlan(u.id);}
      else{setUserPlan("free");setFeatures(DEFAULT_FEATURES);}
    });
    return unsub;
  },[]);

  // Auth handlers
  const handleAuth=async()=>{
    setAuthError("");setAuthLoading(true);
    try{
      if(authMode==="forgot"){await supabase.resetPassword(authEmail);setAuthSuccess("Te enviamos un email para restablecer tu contraseña");setAuthLoading(false);return;}
      if(authMode==="register"){
        if(!authName.trim()){setAuthError("Ingresa tu nombre");setAuthLoading(false);return;}
        const data=await supabase.signUp(authEmail,authPass,authName.trim());
        if(data.user&&!data.session){setAuthSuccess("Revisá tu email para confirmar tu cuenta");setAuthLoading(false);return;}
        setView("home");
      } else {
        await supabase.signIn(authEmail,authPass);
        setView("home");
      }
      setAuthEmail("");setAuthPass("");setAuthName("");
    }catch(e){setAuthError(e.message);}
    setAuthLoading(false);
  };

  const handleGoogleLogin=()=>supabase.signInWithGoogle();
  const logout=async()=>{await supabase.signOut();setUserMenu(false);setView("home");setFile("");setDetections([]);};

  const toggleCat=(id)=>setCats(p=>({...p,[id]:!p[id]}));
  const addKeyword=()=>{const t=kwInput.trim();if(t&&!keywords.includes(t))setKeywords(p=>[...p,t]);setKwInput("");};

  const upload=(name,size)=>{
    if(!user){setView("auth");setAuthMode("login");return;}
    setFile(name||"podcast_ep42.mp3");setFileSize(size?`${(size/1024/1024).toFixed(1)} MB`:"24.3 MB");setView("config");
  };

  const startProcessing=()=>{
    setView("processing");setProgress(0);
    const phases=[{at:0,text:"Extrayendo audio…"},{at:15,text:"Detectando idioma…"},{at:25,text:"Transcribiendo con Whisper AI…"},{at:60,text:"Analizando detecciones…"},{at:80,text:"Aplicando censura…"},{at:95,text:"Finalizando…"}];
    let prog=0;setProcessingPhase(phases[0].text);
    const iv=setInterval(()=>{prog+=Math.random()*3+1;if(prog>=100){prog=100;clearInterval(iv);setTimeout(()=>{setDetections(MOCK_DETECTIONS.map(d=>({...d})));setView("review");},500);}setProgress(Math.min(prog,100));const ph=[...phases].reverse().find(p=>prog>=p.at);if(ph)setProcessingPhase(ph.text);},100);
  };

  const reset=()=>{setFile("");setView("home");setDetections([]);setProgress(0);};
  const handlePlay=(id)=>{if(playingId===id){setPlayingId(null);return;}setPlayingId(id);setTimeout(()=>setPlayingId(null),3000);};

  const flagged=detections.filter(d=>d.censored).length;
  const totalDet=detections.length;
  const filteredDet=detections.filter(d=>{if(filterCat!=="all"&&d.cat!==filterCat)return false;if(searchDet&&!d.word.toLowerCase().includes(searchDet.toLowerCase()))return false;return true;});

  const userName=user?.user_metadata?.display_name||user?.email?.split("@")[0]||"User";

  if(view==="loading") return(<div style={{minHeight:"100vh",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><LoaderBars c={c}/></div>);

  return(
    <div style={{minHeight:"100vh",background:c.bg,color:c.text,transition:"background .4s,color .4s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        :root{--font-display:'Instrument Serif',Georgia,serif;--font-body:'Outfit',system-ui,sans-serif;--font-mono:'IBM Plex Mono',monospace}
        *{box-sizing:border-box;margin:0;padding:0}::selection{background:${c.accent}22}
        @keyframes barPulse{0%,100%{height:8px;opacity:.4}50%{height:24px;opacity:1}}
        @keyframes enterUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes enterScale{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
        @keyframes progressPulse{0%,100%{opacity:1}50%{opacity:.7}}
        @keyframes playPulse{0%,100%{box-shadow:0 0 0 0 ${c.accent}44}50%{box-shadow:0 0 0 6px transparent}}
        @keyframes gentleFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        .grain::after{content:'';position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:${dark?.03:.02};background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px}
        .tag{display:inline-flex;align-items:center;padding:5px 12px;border-radius:100px;font-family:var(--font-mono);font-size:11px;letter-spacing:.04em;font-weight:500;text-transform:uppercase}
        .btn{font-family:var(--font-body);font-weight:600;font-size:14px;border:none;cursor:pointer;border-radius:10px;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
        .btn:active{transform:scale(.97)}
        .btn-fill{background:${c.accent};color:#FFF;padding:13px 28px}.btn-fill:hover{filter:brightness(1.1);box-shadow:${c.shadow3}}
        .btn-ghost{background:transparent;color:${c.textSoft};padding:13px 28px;border:1.5px solid ${c.border}}.btn-ghost:hover{border-color:${c.accent};color:${c.accent}}
        .btn-subtle{background:${c.accentMist};color:${c.accent};padding:10px 20px;font-size:13px}.btn-subtle:hover{background:${c.accentGlow}}
        input::placeholder{color:${c.textFaint}}
      `}</style>
      <div className="grain"/>

      {/* NAV */}
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 28px",height:56,borderBottom:`1px solid ${c.border}`,background:c.surface+(dark?"dd":"ee"),backdropFilter:"blur(16px)",position:"sticky",top:0,zIndex:100}}>
        <div onClick={reset} style={{cursor:"pointer",display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontFamily:"var(--font-display)",fontSize:22,fontStyle:"italic",color:c.accent}}>Censuray</span>
          <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:c.textFaint,letterSpacing:".08em",textTransform:"uppercase"}}>beta</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {file&&!["home","auth","loading"].includes(view)&&<span style={{fontFamily:"var(--font-mono)",fontSize:11,color:c.textFaint,padding:"4px 10px",background:c.bgAlt,borderRadius:6,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file}</span>}
          <button onClick={()=>setDark(!dark)} style={{width:36,height:36,borderRadius:8,background:c.bgAlt,border:`1px solid ${c.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:c.textSoft,fontSize:15}}>{dark?"☀":"☾"}</button>
          {user?(
            <div style={{position:"relative"}}>
              <button onClick={()=>setUserMenu(!userMenu)} style={{height:36,padding:"0 12px",borderRadius:8,background:c.accentMist,border:`1px solid ${c.accent}22`,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:6,background:c.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontFamily:"var(--font-body)",fontSize:11,fontWeight:700}}>{userName[0].toUpperCase()}</div>
                <span style={{fontFamily:"var(--font-body)",fontSize:13,fontWeight:500,color:c.text}}>{userName}</span>
                <PlanBadge plan={userPlan} c={c}/>
              </button>
              {userMenu&&<div style={{position:"absolute",right:0,top:44,width:240,background:c.surface,border:`1px solid ${c.border}`,borderRadius:12,boxShadow:c.shadow2,padding:8,zIndex:200,animation:"enterScale .15s ease"}}>
                <div style={{padding:"12px 12px 8px",borderBottom:`1px solid ${c.border}`,marginBottom:4}}>
                  <p style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:600}}>{userName}</p>
                  <p style={{fontFamily:"var(--font-mono)",fontSize:11,color:c.textFaint}}>{user.email}</p>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}><PlanBadge plan={userPlan} c={c}/><span style={{fontFamily:"var(--font-mono)",fontSize:10,color:c.textFaint}}>{getLimit("max_minutes_per_day")?`${getLimit("max_minutes_per_day")} min/día`:"Ilimitado"}</span></div>
                </div>
                <button onClick={logout} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"none",background:"transparent",color:c.textSoft,cursor:"pointer",fontFamily:"var(--font-body)",fontSize:13,textAlign:"left"}}>Cerrar sesión</button>
              </div>}
            </div>
          ):(
            <button onClick={()=>{setView("auth");setAuthMode("login");}} className="btn btn-fill" style={{padding:"8px 18px",fontSize:13}}>Ingresar</button>
          )}
        </div>
      </nav>
      {userMenu&&<div onClick={()=>setUserMenu(false)} style={{position:"fixed",inset:0,zIndex:99}}/>}

      {/* ═══ AUTH ═══ */}
      {view==="auth"&&(
        <div style={{maxWidth:400,margin:"0 auto",padding:"72px 24px",animation:"enterUp .5s cubic-bezier(.16,1,.3,1)"}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <span style={{fontFamily:"var(--font-display)",fontSize:28,fontStyle:"italic",color:c.accent}}>Censuray</span>
            <h2 style={{fontFamily:"var(--font-display)",fontSize:28,fontStyle:"italic",fontWeight:400,marginTop:16}}>
              {authMode==="login"&&"Bienvenido de vuelta"}{authMode==="register"&&"Crea tu cuenta"}{authMode==="forgot"&&"Recupera tu cuenta"}
            </h2>
            <p style={{fontFamily:"var(--font-body)",fontSize:14,color:c.textSoft,fontWeight:300,marginTop:6}}>
              {authMode==="login"&&"Ingresa para continuar"}{authMode==="register"&&"Empieza gratis — 30 minutos por día"}{authMode==="forgot"&&"Te enviaremos un link de recuperación"}
            </p>
          </div>
          <div style={{background:c.surface,borderRadius:16,border:`1px solid ${c.border}`,padding:28,boxShadow:c.shadow2}}>
            {authSuccess?(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:32,marginBottom:12}}>📧</div>
                <p style={{fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,color:c.ok}}>{authSuccess}</p>
                <button onClick={()=>{setAuthSuccess("");setAuthMode("login");}} className="btn btn-subtle" style={{marginTop:16}}>Volver al login</button>
              </div>
            ):(
              <>
                {authMode==="register"&&<AuthInput label="Nombre" type="text" value={authName} onChange={e=>setAuthName(e.target.value)} c={c} placeholder="Tu nombre"/>}
                <AuthInput label="Email" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} c={c} placeholder="tu@email.com"/>
                {authMode!=="forgot"&&<AuthInput label="Contraseña" type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} c={c} placeholder="••••••••" error={authError&&authError.toLowerCase().includes("password")?authError:""}/>}
                {authError&&!authError.toLowerCase().includes("password")&&<p style={{fontFamily:"var(--font-body)",fontSize:12,color:c.err,marginBottom:12}}>{authError}</p>}
                <button onClick={handleAuth} className="btn btn-fill" style={{width:"100%",justifyContent:"center",marginTop:4,opacity:authLoading?.6:1,pointerEvents:authLoading?"none":"auto"}}>
                  {authLoading?"Cargando…":authMode==="login"?"Ingresar":authMode==="register"?"Crear cuenta":"Enviar link"}
                </button>
                <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}>
                  <div style={{flex:1,height:1,background:c.border}}/><span style={{fontFamily:"var(--font-mono)",fontSize:10,color:c.textFaint}}>o continúa con</span><div style={{flex:1,height:1,background:c.border}}/>
                </div>
                <button onClick={handleGoogleLogin} style={{width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${c.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,color:c.text}}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                <div style={{textAlign:"center",marginTop:20}}>
                  {authMode==="login"&&<><button onClick={()=>{setAuthMode("forgot");setAuthError("");}} style={{fontFamily:"var(--font-body)",fontSize:13,color:c.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500}}>¿Olvidaste tu contraseña?</button><p style={{fontFamily:"var(--font-body)",fontSize:13,color:c.textFaint,marginTop:12}}>¿No tienes cuenta? <button onClick={()=>{setAuthMode("register");setAuthError("");}} style={{color:c.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"var(--font-body)",fontSize:13}}>Regístrate gratis</button></p></>}
                  {authMode==="register"&&<p style={{fontFamily:"var(--font-body)",fontSize:13,color:c.textFaint}}>¿Ya tienes cuenta? <button onClick={()=>{setAuthMode("login");setAuthError("");}} style={{color:c.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"var(--font-body)",fontSize:13}}>Ingresar</button></p>}
                  {authMode==="forgot"&&<button onClick={()=>{setAuthMode("login");setAuthError("");setAuthSuccess("");}} style={{fontFamily:"var(--font-body)",fontSize:13,color:c.accent,background:"none",border:"none",cursor:"pointer"}}>← Volver al login</button>}
                </div>
              </>
            )}
          </div>
          <button onClick={()=>setView("home")} style={{display:"block",margin:"20px auto",fontFamily:"var(--font-body)",fontSize:13,color:c.textFaint,background:"none",border:"none",cursor:"pointer"}}>← Volver al inicio</button>
        </div>
      )}

      {/* ═══ HOME ═══ */}
      {view==="home"&&(
        <div style={{maxWidth:640,margin:"0 auto",padding:"100px 24px 80px",animation:"enterUp .7s cubic-bezier(.16,1,.3,1)"}}>
          <div style={{width:40,height:3,borderRadius:2,background:c.accent,marginBottom:28,opacity:.7}}/>
          <h1 style={{fontFamily:"var(--font-display)",fontSize:"clamp(40px,7vw,64px)",fontWeight:400,fontStyle:"italic",lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:20}}>Censura inteligente<br/><span style={{fontStyle:"normal",color:c.textSoft}}>para tu audio</span></h1>
          <p style={{fontFamily:"var(--font-body)",fontSize:17,lineHeight:1.7,color:c.textSoft,maxWidth:440,marginBottom:40,fontWeight:300}}>Sube tu podcast, entrevista o video. Configura qué censurar. Revisa cada detección con contexto. Descarga el resultado.</p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:64}}>
            <button className="btn btn-fill" onClick={()=>user?setView("upload"):(()=>{setView("auth");setAuthMode("register")})()}>
              {user?"Subir archivo":"Comenzar gratis"} <span style={{fontSize:16,opacity:.7}}>→</span>
            </button>
            <button className="btn btn-ghost" onClick={()=>upload("demo_podcast_ep42.mp3",25400000)}>Ver demo</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:c.border,borderRadius:14,overflow:"hidden"}}>
            {[{n:"01",t:"Configura, no edites",d:"Define las reglas y la IA procesa horas de audio automáticamente"},{n:"02",t:"Revisa cada detección",d:"Escucha el contexto y decide cuáles mantener censuradas"},{n:"03",t:"Más que groserías",d:"Nombres, datos personales, marcas — tú decides"},{n:"04",t:"Tu sonido",d:"Bleep, silencio, bocina, risa o sube tu propio audio"}].map((item,i)=>(
              <div key={i} style={{padding:"28px 24px",background:c.surface,animation:`enterUp .6s cubic-bezier(.16,1,.3,1) ${.08*i+.3}s both`}}>
                <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:c.accent,letterSpacing:".06em",display:"block",marginBottom:10}}>{item.n}</span>
                <span style={{fontFamily:"var(--font-display)",fontSize:19,fontStyle:"italic",display:"block",marginBottom:6}}>{item.t}</span>
                <span style={{fontFamily:"var(--font-body)",fontSize:13,color:c.textSoft,lineHeight:1.5,fontWeight:300}}>{item.d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ UPLOAD ═══ */}
      {view==="upload"&&(
        <div style={{maxWidth:520,margin:"0 auto",padding:"72px 24px",animation:"enterUp .5s cubic-bezier(.16,1,.3,1)"}}>
          <span className="tag" style={{background:c.accentMist,color:c.accent,marginBottom:20}}>Paso 1 — Archivo</span>
          <h2 style={{fontFamily:"var(--font-display)",fontSize:32,fontStyle:"italic",fontWeight:400,marginBottom:6}}>Sube tu archivo</h2>
          <p style={{fontFamily:"var(--font-body)",fontSize:14,color:c.textSoft,marginBottom:4,fontWeight:300}}>Audio o video — MP3, WAV, M4A, MP4, MOV, WEBM</p>
          <p style={{fontFamily:"var(--font-mono)",fontSize:11,color:c.textFaint,marginBottom:32}}>{getLimit("max_minutes_per_day")?`${getLimit("max_minutes_per_day")} min/día`:"Ilimitado"} · Máx {getLimit("max_file_size_mb")>=1000?`${getLimit("max_file_size_mb")/1000}GB`:`${getLimit("max_file_size_mb")}MB`}</p>
          <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)upload(f.name,f.size);}} onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept="audio/*,video/*";inp.onchange=e=>{const f=e.target.files[0];if(f)upload(f.name,f.size);};inp.click();}}
            style={{border:`1.5px dashed ${drag?c.accent:c.border}`,borderRadius:16,padding:"64px 24px",textAlign:"center",cursor:"pointer",background:drag?c.accentMist:c.surface,transition:"all .25s",boxShadow:drag?c.shadow3:c.shadow1}}>
            <div style={{width:56,height:56,borderRadius:14,background:c.accentMist,border:`1px solid ${c.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",color:c.accent,fontSize:22,animation:drag?"gentleFloat 1s ease-in-out infinite":"none"}}>↑</div>
            <p style={{fontFamily:"var(--font-body)",fontSize:15,fontWeight:500,marginBottom:6}}>{drag?"Suelta aquí":"Arrastra tu archivo"}</p>
            <p style={{fontFamily:"var(--font-body)",fontSize:13,color:c.textFaint,fontWeight:300}}>o haz clic para seleccionar</p>
          </div>
          <button className="btn btn-ghost" onClick={()=>setView("home")} style={{marginTop:20,width:"100%",justifyContent:"center"}}>← Volver</button>
        </div>
      )}

      {/* ═══ CONFIG ═══ */}
      {view==="config"&&(
        <div style={{maxWidth:660,margin:"0 auto",padding:"36px 24px 60px",animation:"enterUp .5s cubic-bezier(.16,1,.3,1)"}}>
          <span className="tag" style={{background:c.accentMist,color:c.accent,marginBottom:10}}>Paso 2 — Configuración</span>
          <h2 style={{fontFamily:"var(--font-display)",fontSize:28,fontStyle:"italic",fontWeight:400,marginTop:8,marginBottom:24}}>Configura la censura</h2>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:10,background:c.surface,border:`1px solid ${c.border}`,marginBottom:20}}>
            <div style={{width:36,height:36,borderRadius:8,background:c.accentMist,display:"flex",alignItems:"center",justifyContent:"center",color:c.accent,fontFamily:"var(--font-mono)",fontSize:11,fontWeight:500}}>{file.split('.').pop()?.toUpperCase()}</div>
            <div style={{flex:1}}><div style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:500}}>{file}</div><div style={{fontFamily:"var(--font-mono)",fontSize:11,color:c.textFaint}}>{fileSize}</div></div>
            <button onClick={()=>setView("upload")} style={{fontFamily:"var(--font-body)",fontSize:12,fontWeight:500,color:c.accent,background:"none",border:"none",cursor:"pointer"}}>Cambiar</button>
          </div>
          <Section c={c} delay={.05}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}><div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{fontSize:20}}>✨</span><span style={{fontFamily:"var(--font-body)",fontSize:16,fontWeight:600}}>Apto para todo público</span></div><p style={{fontFamily:"var(--font-body)",fontSize:12,color:c.textSoft,fontWeight:300,marginLeft:28}}>Censura todo lenguaje inapropiado</p></div><Toggle on={familyFriendly} onChange={()=>setFamilyFriendly(!familyFriendly)} c={c}/></div></Section>
          <Section title="Qué detectar" c={c} delay={.1}>
            {CATEGORIES.map(cat=>{const allowed=canUse(cat.featureKey);return(
              <div key={cat.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${c.border}`}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,flex:1}}><span style={{fontSize:18,marginTop:1}}>{cat.icon}</span><div><span style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>{cat.label}{!allowed&&<PlanBadge plan="pro" c={c}/>}</span><span style={{fontFamily:"var(--font-body)",fontSize:12,color:c.textFaint,fontWeight:300}}>{cat.desc}</span></div></div>
                <Toggle on={cats[cat.id]} onChange={()=>toggleCat(cat.id)} c={c} disabled={!allowed}/>
              </div>
            );})}
          </Section>
          {canUse("sensitivity_levels")&&<Section title="Sensibilidad" c={c} delay={.15}><div style={{display:"flex",gap:8}}>{SENSITIVITY.map(s=><button key={s.id} onClick={()=>setSensitivity(s.id)} style={{flex:1,padding:"12px 10px",borderRadius:10,cursor:"pointer",background:sensitivity===s.id?c.accent:"transparent",border:`1.5px solid ${sensitivity===s.id?c.accent:c.border}`,textAlign:"left"}}><span style={{fontFamily:"var(--font-body)",fontSize:13,fontWeight:600,color:sensitivity===s.id?"#FFF":c.text,display:"block"}}>{s.label}</span><span style={{fontFamily:"var(--font-body)",fontSize:11,color:sensitivity===s.id?"rgba(255,255,255,.6)":c.textFaint,fontWeight:300}}>{s.desc}</span></button>)}</div></Section>}
          {canUse("custom_keywords")&&<Section title="Palabras personalizadas" c={c} delay={.2}><div style={{display:"flex",gap:8,marginBottom:keywords.length?12:0}}><input value={kwInput} onChange={e=>setKwInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addKeyword();}} placeholder="Escribe una palabra…" style={{flex:1,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${c.border}`,background:c.bgAlt,fontFamily:"var(--font-body)",fontSize:13,color:c.text,outline:"none"}} onFocus={e=>e.target.style.borderColor=c.accent} onBlur={e=>e.target.style.borderColor=c.border}/><button className="btn btn-subtle" onClick={addKeyword}>+ Agregar</button></div>{keywords.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{keywords.map(kw=><KeywordTag key={kw} word={kw} onRemove={()=>setKeywords(p=>p.filter(k=>k!==kw))} c={c}/>)}</div>}</Section>}
          <Section title="Sonido de reemplazo" c={c} delay={.25}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{SOUNDS.map(s=>{const locked=s.requiresPro&&!canUse("custom_replacement_sound");return(<button key={s.id} onClick={locked?undefined:()=>setSound(s.id)} style={{padding:"14px 16px",borderRadius:10,cursor:locked?"not-allowed":"pointer",background:sound===s.id&&!locked?c.accent:"transparent",border:`1.5px solid ${sound===s.id&&!locked?c.accent:c.border}`,textAlign:"left",display:"flex",alignItems:"center",gap:12,opacity:locked?.45:1}}><span style={{fontFamily:"var(--font-mono)",fontSize:16,color:sound===s.id&&!locked?"#FFF":c.accent}}>{s.icon}</span><div><span style={{fontFamily:"var(--font-body)",fontSize:13,fontWeight:600,color:sound===s.id&&!locked?"#FFF":c.text,display:"flex",alignItems:"center",gap:6}}>{s.label}{locked&&<PlanBadge plan="pro" c={c}/>}</span><span style={{fontFamily:"var(--font-mono)",fontSize:10,color:sound===s.id&&!locked?"rgba(255,255,255,.55)":c.textFaint}}>{s.desc}</span></div></button>);})}</div></Section>
          <Section title="Avanzado" c={c} delay={.3}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${c.border}`}}><span style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:500}}>Detectar idioma automáticamente</span><Toggle on={autoDetectLang} onChange={()=>setAutoDetectLang(!autoDetectLang)} c={c}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${c.border}`}}><span style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>Preservar video{!canUse("export_video")&&<PlanBadge plan="pro" c={c}/>}</span><Toggle on={preserveVideo} onChange={()=>setPreserveVideo(!preserveVideo)} c={c} disabled={!canUse("export_video")}/></div>
            <div style={{padding:"14px 0"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontFamily:"var(--font-body)",fontSize:14,fontWeight:500}}>Margen de corte</span><span style={{fontFamily:"var(--font-mono)",fontSize:12,color:c.accent}}>{padding}ms</span></div><input type="range" min="0" max="200" value={padding} onChange={e=>setPadding(Number(e.target.value))} style={{width:"100%",accentColor:c.accent}}/></div>
          </Section>
          <div style={{display:"flex",gap:10,marginTop:8,justifyContent:"space-between",flexWrap:"wrap"}}><button className="btn btn-ghost" onClick={()=>setView("upload")}>← Cambiar archivo</button><button className="btn btn-fill" onClick={startProcessing}>Procesar audio <span style={{fontSize:16,opacity:.7}}>→</span></button></div>
        </div>
      )}

      {/* ═══ PROCESSING ═══ */}
      {view==="processing"&&(
        <div style={{maxWidth:480,margin:"0 auto",padding:"80px 24px",animation:"enterScale .5s cubic-bezier(.16,1,.3,1)"}}>
          <div style={{background:c.surface,borderRadius:20,border:`1px solid ${c.border}`,boxShadow:c.shadow2,padding:"44px 32px",textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:24}}><LoaderBars c={c}/></div>
            <h3 style={{fontFamily:"var(--font-display)",fontSize:22,fontStyle:"italic",marginBottom:8}}>Procesando</h3>
            <p style={{fontFamily:"var(--font-body)",fontSize:13,color:c.textSoft,fontWeight:300,marginBottom:24,animation:"progressPulse 2s ease-in-out infinite"}}>{processingPhase}</p>
            <div style={{height:4,borderRadius:2,background:c.bgAlt,overflow:"hidden",marginBottom:12}}><div style={{height:"100%",borderRadius:2,background:c.accent,width:`${progress}%`,transition:"width .3s"}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-mono)",fontSize:11,color:c.textFaint}}><span>{file}</span><span>{Math.round(progress)}%</span></div>
          </div>
        </div>
      )}

      {/* ═══ REVIEW ═══ */}
      {view==="review"&&(
        <div style={{maxWidth:780,margin:"0 auto",padding:"36px 24px 60px",animation:"enterUp .5s cubic-bezier(.16,1,.3,1)"}}>
          <span className="tag" style={{background:c.accentMist,color:c.accent,marginBottom:10}}>Paso 3 — Revisión</span>
          <h2 style={{fontFamily:"var(--font-display)",fontSize:28,fontStyle:"italic",fontWeight:400,marginTop:8,marginBottom:20}}>Revisar detecciones</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:c.border,borderRadius:12,overflow:"hidden",marginBottom:20}}>
            {[{l:"Detectadas",v:totalDet},{l:"Censuradas",v:flagged,a:true},{l:"Conservadas",v:totalDet-flagged},{l:"Duración",v:"1:24:32"}].map((s,i)=><div key={i} style={{padding:16,background:c.surface,textAlign:"center"}}><span style={{fontFamily:"var(--font-mono)",fontSize:9,color:c.textFaint,textTransform:"uppercase",display:"block",marginBottom:4}}>{s.l}</span><span style={{fontFamily:"var(--font-body)",fontSize:22,fontWeight:700,color:s.a?c.accent:c.text}}>{s.v}</span></div>)}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <input value={searchDet} onChange={e=>setSearchDet(e.target.value)} placeholder="Buscar palabra…" style={{padding:"9px 14px",borderRadius:8,border:`1.5px solid ${c.border}`,background:c.bgAlt,fontFamily:"var(--font-body)",fontSize:13,color:c.text,outline:"none",width:180}} onFocus={e=>e.target.style.borderColor=c.accent} onBlur={e=>e.target.style.borderColor=c.border}/>
            <div style={{display:"flex",gap:4}}>{[{id:"all",label:"Todas"},...CATEGORIES].map(cat=><button key={cat.id} onClick={()=>setFilterCat(cat.id)} style={{padding:"7px 12px",borderRadius:8,border:`1.5px solid ${filterCat===cat.id?c.accent:c.border}`,background:filterCat===cat.id?c.accentMist:"transparent",color:filterCat===cat.id?c.accent:c.textSoft,fontFamily:"var(--font-body)",fontSize:12,fontWeight:500,cursor:"pointer"}}>{cat.icon&&<span style={{marginRight:4}}>{cat.icon}</span>}{cat.label}</button>)}</div>
          </div>
          <div style={{background:c.surface,borderRadius:14,border:`1px solid ${c.border}`,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${c.border}`,background:c.bgAlt}}>
              <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:c.textFaint,textTransform:"uppercase"}}>{filteredDet.length} detección{filteredDet.length!==1?"es":""}</span>
              <div style={{display:"flex",gap:8}}><button onClick={()=>setDetections(ds=>ds.map(d=>({...d,censored:true})))} style={{fontFamily:"var(--font-mono)",fontSize:10,color:c.accent,background:"none",border:"none",cursor:"pointer"}}>Censurar todas</button><span style={{color:c.border}}>|</span><button onClick={()=>setDetections(ds=>ds.map(d=>({...d,censored:false})))} style={{fontFamily:"var(--font-mono)",fontSize:10,color:c.textFaint,background:"none",border:"none",cursor:"pointer"}}>Quitar todas</button></div>
            </div>
            <div style={{maxHeight:480,overflowY:"auto"}}>{filteredDet.map(det=><DetectionRow key={det.id} det={det} onToggle={()=>setDetections(ds=>ds.map(d=>d.id===det.id?{...d,censored:!d.censored}:d))} onPlay={()=>handlePlay(det.id)} playing={playingId===det.id} c={c}/>)}{filteredDet.length===0&&<div style={{padding:40,textAlign:"center"}}><p style={{fontFamily:"var(--font-body)",fontSize:14,color:c.textFaint}}>No se encontraron detecciones</p></div>}</div>
          </div>
          {playingId&&<div style={{marginTop:12,padding:"10px 16px",borderRadius:10,background:c.accentMist,border:`1px solid ${c.accent}22`,display:"flex",alignItems:"center",gap:12}}><div style={{width:8,height:8,borderRadius:"50%",background:c.accent,animation:"playPulse 1.5s ease-in-out infinite"}}/><span style={{fontFamily:"var(--font-body)",fontSize:13,color:c.accent,fontWeight:500}}>Reproduciendo: 10s antes → palabra → 10s después</span></div>}
          <div style={{display:"flex",gap:10,marginTop:24,justifyContent:"space-between",flexWrap:"wrap"}}>
            <button className="btn btn-ghost" onClick={()=>setView("config")}>← Reconfigurar</button>
            <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontFamily:"var(--font-mono)",fontSize:12,color:c.textSoft}}>{flagged}/{totalDet} activas</span><button className="btn btn-fill">Descargar audio ↓</button></div>
          </div>
        </div>
      )}

      <footer style={{textAlign:"center",padding:"48px 24px 20px",fontFamily:"var(--font-mono)",fontSize:10,color:c.textFaint}}>Censuray © 2026</footer>
    </div>
  );
}
