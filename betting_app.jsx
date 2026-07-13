import { useState, useEffect, useRef, useCallback } from "react";

const STARTING_BALANCE = 1000;
const ACCENT = "#0047FF";

const runtimeEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const SUPABASE_URL = runtimeEnv.VITE_SUPABASE_URL || "https://gbgiucoomnnidddtykmt.supabase.co";
const SUPABASE_ANON_KEY = runtimeEnv.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ2l1Y29vbW5uaWRkZHR5a210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjE0MjYsImV4cCI6MjA5ODk5NzQyNn0.sFCjZV-I-PREhmRlh0Cd673_iAaF0eTM7Z09iH0i9NU";

// ── Supabase fetch helpers ────────────────────────────────────────────────────

async function sbFetch(path, opts = {}) {
  const { method = "GET", body, token, prefer } = opts;
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (prefer) headers["Prefer"] = prefer;

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) throw new Error(data?.message || data?.error_description || JSON.stringify(data) || "Request failed");
  return data;
}

// Auth
async function signUp(email, password, username) {
  const data = await sbFetch("/auth/v1/signup", {
    method: "POST",
    body: { email, password, options: { data: { username } } },
  });
  return data;
}

async function signIn(email, password) {
  return sbFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
}

async function signOut(token) {
  return sbFetch("/auth/v1/logout", { method: "POST", token });
}

// Profiles
async function getProfile(userId, token) {
  const rows = await sbFetch(`/rest/v1/profiles?id=eq.${userId}&select=*`, { token });
  return rows?.[0] || null;
}

async function createProfile(userId, username, token) {
  return sbFetch("/rest/v1/profiles", {
    method: "POST",
    token,
    prefer: "return=representation",
    body: { id: userId, username, balance: STARTING_BALANCE, wins: 0, losses: 0 },
  });
}

async function updateProfile(userId, updates, token) {
  return sbFetch(`/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    token,
    prefer: "return=representation",
    body: updates,
  });
}

async function getAllProfiles(token) {
  return sbFetch("/rest/v1/profiles?select=*&order=balance.desc", { token });
}

// Bets
async function getBets(token) {
  return sbFetch("/rest/v1/bets?select=*&order=created_at.desc", { token });
}

async function createBet(bet, token) {
  return sbFetch("/rest/v1/bets", {
    method: "POST",
    token,
    prefer: "return=representation",
    body: bet,
  });
}

async function updateBet(betId, updates, token) {
  return sbFetch(`/rest/v1/bets?id=eq.${betId}`, {
    method: "PATCH",
    token,
    prefer: "return=representation",
    body: updates,
  });
}

// ── Face image (embedded, trimmed for brevity — just the face PNG base64) ────
// (same FACE_IMG as before — only the pixel stripping canvas logic uses it)
const FACE_IMG = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH";

// ── Design tokens ─────────────────────────────────────────────────────────────

const mono = `'JetBrains Mono', 'Fira Mono', monospace`;
const sans = `'Inter', system-ui, sans-serif`;
const pixel = `'Pixelify Sans', monospace`;

function theme(dark) {
  return {
    bg:        dark ? "#0d0d0d" : "#F7F7F7",
    surface:   dark ? "#141414" : "#ffffff",
    border:    dark ? "#222"    : "#e0ddd6",
    border2:   dark ? "#2a2a2a" : "#d0cdc6",
    text:      dark ? "#e8e8e8" : "#111111",
    textMid:   dark ? "#888"    : "#555555",
    textDim:   dark ? "#444"    : "#999999",
    inputBg:   dark ? "#111"    : "#ffffff",
    inputText: dark ? "#ddd"    : "#111111",
    btnSecBg:  dark ? "#1e1e1e" : "#f0ede8",
    btnSecTxt: dark ? "#ccc"    : "#333333",
    toastBg:   dark ? "#111"    : "#1a1a1a",
    toastTxt:  dark ? "#ddd"    : "#f0f0f0",
    rowHover:  dark ? `rgba(0,71,255,0.05)` : `rgba(0,71,255,0.04)`,
    win:       dark ? "#4ade80" : "#16a34a",
    loss:      dark ? "#f87171" : "#dc2626",
  };
}

// ── Small UI components ────────────────────────────────────────────────────────

function Coin({ size = 16 }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display:"inline-block", verticalAlign:"middle", marginRight:2, flexShrink:0 }}>
      <circle cx={r} cy={r} r={r} fill={ACCENT} />
      <text x={r} y={r + size * 0.14} textAnchor="middle"
        fontFamily={pixel} fontSize={size * 0.38} fontWeight="700"
        letterSpacing="-1" fill="#fff">SV</text>
    </svg>
  );
}

function Pill({ status, dark }) {
  const t = theme(dark);
  const map = {
    open:      { label: "OPEN",    fg: ACCENT,    bg: "transparent", border: ACCENT },
    matched:   { label: "LIVE",    fg: t.text,    bg: t.surface,     border: t.border2 },
    settled:   { label: "SETTLED", fg: t.textDim, bg: "transparent", border: t.border },
    cancelled: { label: "VOID",    fg: t.textDim, bg: "transparent", border: t.border },
  };
  const s = map[status] || map.cancelled;
  return (
    <span style={{
      fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
      color: s.fg, background: s.bg, border: `1px solid ${s.border}`,
      padding: "3px 8px", borderRadius: 3, whiteSpace: "nowrap"
    }}>{s.label}</span>
  );
}

function Avatar({ name, size = 34, dark }) {
  const idx = name.charCodeAt(0) % 5;
  const bgsDark  = ["#1e1e1e","#252525","#2a2a2a","#1a1a1a","#202020"];
  const bgsLight = ["#e8e5e0","#dedad4","#d4d0ca","#e0ddd7","#dad7d1"];
  const bg = dark ? bgsDark[idx] : bgsLight[idx];
  const color = dark ? "#777" : "#888";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: mono, fontWeight: 700, fontSize: size * 0.33, color, letterSpacing: "0.04em"
    }}>{name.slice(0,2).toUpperCase()}</div>
  );
}

function Spinner({ dark }) {
  const t = theme(dark);
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
      <div style={{
        width: 24, height: 24, border: `2px solid ${t.border}`,
        borderTopColor: ACCENT, borderRadius: "50%",
        animation: "spin 0.7s linear infinite"
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ModeToggle({ dark, onToggle }) {
  const t = theme(dark);
  return (
    <button onClick={onToggle} aria-label="Toggle dark/light mode" style={{
      display: "flex", alignItems: "center", gap: 6,
      fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
      color: t.textDim, background: "transparent",
      border: `1px solid ${t.border}`, borderRadius: 3,
      padding: "5px 10px", cursor: "pointer"
    }}>
      <span style={{ fontSize: 13 }}>{dark ? "☀" : "☾"}</span>
      {dark ? "LIGHT" : "DARK"}
    </button>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo({ textColor }) {
  return (
    <svg width="60" height="35" viewBox="0 0 409 238" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <path d="M345.938 232.354V196.831C351.944 205.034 358.438 209.136 365.421 209.136C368.058 209.136 370.206 208.452 371.866 207.085C373.526 205.669 374.356 203.911 374.356 201.812C374.356 198.784 372.55 195.83 368.937 192.949L363.956 189.067C360.636 186.577 357.804 184.111 355.46 181.67C353.116 179.18 351.212 176.641 349.747 174.053C348.282 171.416 347.208 168.706 346.524 165.923C345.841 163.14 345.499 160.21 345.499 157.134C345.499 151.86 346.72 146.343 349.161 140.581C350.382 137.896 351.798 135.454 353.409 133.257C355.021 131.011 356.876 129.033 358.976 127.324C364.737 122.441 371.695 120 379.85 120C387.125 120 394.449 121.929 401.822 125.786V160.356C399.332 156.499 396.5 153.472 393.326 151.274C390.152 149.028 387.027 147.905 383.951 147.905C381.607 147.905 379.679 148.589 378.165 149.956C376.603 151.274 375.821 152.861 375.821 154.717C375.821 157.744 377.896 160.747 382.047 163.726L386.881 167.314C393.326 171.953 397.94 176.714 400.724 181.597C403.556 186.479 404.972 192.192 404.972 198.735C404.972 209.868 401.578 219.048 394.791 226.274C388.004 233.501 379.41 237.114 369.01 237.114C361.832 237.114 354.142 235.527 345.938 232.354Z" fill={textColor}/>
      <path d="M324.95 235.137H294.408V149.15H277.562V122.051H342.455V149.15H324.95V235.137Z" fill={textColor}/>
      <path d="M215.6 235.137V122.051H272.362V148.638H246.142V165.117H269.652V190.679H246.142V207.964H272.362V235.137H215.6Z" fill={textColor}/>
      <path d="M133.158 235.137V122.051H168.681C181.962 122.051 191.801 124.98 198.197 130.84C204.691 136.846 207.938 144.609 207.938 154.131C207.938 168.291 200.907 175.957 186.845 177.129C194.853 178.301 200.712 180.938 204.423 185.039C208.183 189.141 210.062 195.049 210.062 202.764C210.062 212.48 206.913 220.293 200.614 226.201C194.364 232.158 186.137 235.137 175.932 235.137H133.158ZM163.7 210.601C164.286 210.649 164.799 210.698 165.238 210.747C165.678 210.747 166.044 210.747 166.337 210.747C170.146 210.747 173.173 209.746 175.419 207.744C177.714 205.742 178.861 203.057 178.861 199.688C178.861 196.318 177.714 193.682 175.419 191.777C173.173 189.873 170.072 188.921 166.117 188.921H163.7V210.601ZM163.7 165.996H165.751C169.413 165.996 172.294 165.142 174.394 163.433C176.542 161.724 177.616 159.331 177.616 156.255C177.616 149.712 174.027 146.44 166.85 146.44C166.508 146.44 166.068 146.465 165.531 146.514C165.043 146.514 164.433 146.538 163.7 146.587V165.996Z" fill={textColor}/>
      <path d="M382.633 115.137H352.091V67.2363L324.039 2.05078H355.899L361.393 18.8232C362.467 22.0947 363.419 25.2441 364.249 28.2715C365.128 31.2988 365.909 34.2041 366.593 36.9873C367.716 32.8369 368.692 29.2725 369.522 26.2939C370.353 23.2666 371.085 20.8252 371.72 18.9697L377.286 2.05078H408.927L382.633 67.2363V115.137Z" fill={textColor}/>
      <path d="M324.587 115.137H291.628L271.34 62.9883L272.146 115.137H241.604V2.05078H272.146L271.34 50.5371L289.357 2.05078H321.584L297.194 56.6162L324.587 115.137Z" fill={textColor}/>
      <path d="M235.955 80.3467L234.197 113.013C227.41 115.747 221.331 117.114 215.96 117.114C203.313 117.114 192.669 112.476 184.026 103.198C174.358 92.7979 169.524 78.0762 169.524 59.0332C169.524 41.2109 174.065 26.9043 183.147 16.1133C192.229 5.37109 204.363 0 219.549 0C224.48 0 229.51 0.927734 234.637 2.7832V35.083C230.096 30.542 225.433 28.2715 220.647 28.2715C214.397 28.2715 209.515 30.9326 205.999 36.2549C202.483 41.626 200.726 49.0479 200.726 58.5205C200.726 63.1104 201.165 67.2119 202.044 70.8252C202.923 74.4385 204.168 77.4902 205.779 79.9805C207.439 82.4707 209.466 84.375 211.858 85.6934C214.251 87.0117 216.985 87.6709 220.062 87.6709C225.335 87.6709 230.633 85.2295 235.955 80.3467Z" fill={textColor}/>
      <path d="M163.987 115.137H133.445V2.05078H163.987V115.137Z" fill={textColor}/>
      <path d="M109.53 115.137H78.9883V29.1504H62.1426V2.05078H127.035V29.1504H109.53V115.137Z" fill={textColor}/>
      <path d="M0.616211 112.354V76.8311C6.62207 85.0342 13.1162 89.1357 20.0986 89.1357C22.7354 89.1357 24.8838 88.4521 26.5439 87.085C28.2041 85.6689 29.0342 83.9111 29.0342 81.8115C29.0342 78.7842 27.2275 75.8301 23.6143 72.9492L18.6338 69.0674C15.3135 66.5771 12.4814 64.1113 10.1377 61.6699C7.79395 59.1797 5.88965 56.6406 4.4248 54.0527C2.95996 51.416 1.88574 48.7061 1.20215 45.9229C0.518555 43.1396 0.176758 40.21 0.176758 37.1338C0.176758 31.8604 1.39746 26.3428 3.83887 20.5811C5.05957 17.8955 6.47559 15.4541 8.08691 13.2568C9.69824 11.0107 11.5537 9.0332 13.6533 7.32422C19.415 2.44141 26.373 0 34.5273 0C41.8027 0 49.127 1.92871 56.5 5.78613V40.3564C54.0098 36.499 51.1777 33.4717 48.0039 31.2744C44.8301 29.0283 41.7051 27.9053 38.6289 27.9053C36.2852 27.9053 34.3564 28.5889 32.8428 29.9561C31.2803 31.2744 30.499 32.8613 30.499 34.7168C30.499 37.7441 32.5742 40.7471 36.7246 43.7256L41.5586 47.3145C48.0039 51.9531 52.6182 56.7139 55.4014 61.5967C58.2334 66.4795 59.6494 72.1924 59.6494 78.7354C59.6494 89.8682 56.2559 99.0479 49.4688 106.274C42.6816 113.501 34.0879 117.114 23.6875 117.114C16.5098 117.114 8.81934 115.527 0.616211 112.354Z" fill={textColor}/>
      <rect x="125" y="235.137" width="43" height="113" transform="rotate(180 125 235.137)" fill="#0047FF"/>
      <rect x="43" y="160.137" width="43" height="38" transform="rotate(180 43 160.137)" fill="#0047FF"/>
      <rect x="84" y="197.137" width="43" height="75" transform="rotate(180 84 197.137)" fill="#0047FF"/>
    </svg>
  );
}

// ── Winner animation ───────────────────────────────────────────────────────────

function StrippedFace() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const brightness = (d[i] + d[i+1] + d[i+2]) / 3;
        if (brightness < 30) d[i+3] = 0;
        else if (brightness < 60) d[i+3] = Math.round(((brightness-30)/30)*255);
      }
      ctx.putImageData(imageData, 0, 0);
    };
    img.src = FACE_IMG;
  }, []);
  return (
    <canvas ref={canvasRef} style={{
      width: 260, height: "auto", display: "block",
      filter: "drop-shadow(0 0 40px rgba(0,71,255,0.6))",
      animation: "popIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards, wiggle 0.7s ease-in-out 0.55s infinite"
    }} />
  );
}

function WinnerModal({ onClose }) {
  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.88)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer"
    }}>
      <style>{`
        @keyframes wiggle{0%{transform:rotate(0deg) scale(1)}15%{transform:rotate(-4deg) scale(1.03)}30%{transform:rotate(4deg) scale(1.03)}45%{transform:rotate(-3deg) scale(1.01)}60%{transform:rotate(3deg) scale(1.01)}75%{transform:rotate(-1.5deg) scale(1)}90%{transform:rotate(1.5deg) scale(1)}100%{transform:rotate(0deg) scale(1)}}
        @keyframes popIn{0%{opacity:0;transform:scale(0.5) translateY(40px)}60%{transform:scale(1.06) translateY(-8px)}80%{transform:scale(0.97) translateY(2px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeSlideDown{0%{opacity:0;transform:translateY(-16px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes fadeSlideUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{fontFamily:pixel,fontSize:28,fontWeight:700,color:"#fff",letterSpacing:"-0.04em",animation:"fadeSlideDown 0.4s ease 0.15s both",marginBottom:20,textAlign:"center"}}>winner winner</div>
      <StrippedFace />
      <div style={{fontFamily:pixel,fontSize:28,fontWeight:700,color:"#fff",letterSpacing:"-0.04em",animation:"fadeSlideUp 0.4s ease 0.25s both",marginTop:20,textAlign:"center"}}>sticky dinner</div>
      <div style={{fontFamily:pixel,fontSize:13,color:"rgba(255,255,255,0.3)",marginTop:32,letterSpacing:"0.05em",animation:"fadeSlideUp 0.4s ease 0.5s both"}}>tap to dismiss</div>
    </div>
  );
}

async function ensureProfile(userId, username, token) {
  try {
    const existing = await getProfile(userId, token);
    if (existing) return existing;
    return await createProfile(userId, username, token);
  } catch (e) {
    console.warn("Profile creation failed, continuing without remote profile:", e);
    return { id: userId, username, balance: STARTING_BALANCE, wins: 0, losses: 0 };
  }
}

// ── Auth screen ────────────────────────────────────────────────────────────────

function AuthScreen({ dark, onToggleDark, onAuth }) {
  const t = theme(dark);
  const [mode, setMode]         = useState("login"); // "login" | "signup"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    fontFamily: mono, fontSize: 14,
    background: t.inputBg, color: t.inputText,
    border: `1px solid ${t.border2}`, borderRadius: 4,
    padding: "10px 12px", outline: "none",
    colorScheme: dark ? "dark" : "light",
  };

  async function handleSubmit() {
    setError("");
    if (!email || !password) return setError("Email and password required");
    if (mode === "signup" && !username.trim()) return setError("Pick a username");
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await signUp(email, password, username.trim());
        // After signup user needs to sign in to get a token
        if (res?.user?.id) {
          const loginRes = await signIn(email, password);
          const profile = await ensureProfile(res.user.id, username.trim(), loginRes.access_token);
          onAuth({ token: loginRes.access_token, userId: res.user.id, username: profile.username });
        } else {
          setError("Signup succeeded — check your email to confirm, then log in.");
          setMode("login");
        }
      } else {
        const res = await signIn(email, password);
        const profile = await ensureProfile(res.user.id, res.user.user_metadata?.username || email.split("@")[0], res.access_token);
        onAuth({ token: res.access_token, userId: res.user.id, username: profile.username });
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.25rem" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Pixelify+Sans:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ position: "absolute", top: 24, right: 24 }}>
        <ModeToggle dark={dark} onToggle={onToggleDark} />
      </div>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <Logo textColor={t.text} />
          </div>
          <p style={{ fontFamily: sans, fontSize: 13, color: t.textDim, margin: 0, marginTop: 8 }}>
            Social betting for your crew
          </p>
        </div>

        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: "28px 24px" }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid ${t.border}` }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                fontFamily: sans, fontSize: 13, fontWeight: 600, padding: "8px 0", flex: 1,
                background: "transparent", border: "none", cursor: "pointer",
                color: mode === m ? t.text : t.textDim,
                borderBottom: mode === m ? `2px solid ${ACCENT}` : "2px solid transparent",
              }}>{m === "login" ? "Log in" : "Sign up"}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && (
              <div>
                <label style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>USERNAME</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. Finn" style={inputStyle} />
              </div>
            )}
            <div>
              <label style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>

            {error && (
              <div style={{ fontFamily: sans, fontSize: 12, color: t.loss, background: dark ? "#2a1010" : "#fef2f2", border: `1px solid ${dark ? "#5a2020" : "#fecaca"}`, borderRadius: 4, padding: "8px 12px" }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              fontFamily: sans, fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
              background: ACCENT, color: "#fff", border: "none",
              padding: "11px 0", borderRadius: 4, cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1, marginTop: 4
            }}>
              {loading ? "…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <p style={{ fontFamily: sans, fontSize: 12, color: t.textDim, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
            Everyone starts with <span style={{ fontFamily: mono, color: t.textMid }}>SV1,000</span>. May the best bettor win.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Bet card ───────────────────────────────────────────────────────────────────

function BetCard({ bet, currentUserId, currentUsername, onJoin, onSettle, onCancel, dark }) {
  const t = theme(dark);
  const isCreator = bet.creator_id === currentUserId;
  const canJoin   = bet.status === "open" && !isCreator;
  const canSettle = bet.status === "matched" && isCreator;
  const canCancel = bet.status === "open" && isCreator;
  const pot       = bet.stake + Math.round(bet.stake * bet.odds);
  const oppCost   = Math.round(bet.stake * bet.odds);

  const isSecret     = bet.secret;
  const descRevealed = !isSecret || isCreator || bet.status === "settled";
  const justRevealed = isSecret && bet.status === "settled";

  return (
    <div style={{ borderTop: `1px solid ${t.border}`, padding: "16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          {isSecret && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 11 }}>{justRevealed ? "🔓" : "🔒"}</span>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", color: justRevealed ? ACCENT : t.textDim }}>
                {justRevealed ? "REVEALED" : isCreator ? "SECRET — ONLY YOU CAN SEE THIS" : "SECRET BET"}
              </span>
            </div>
          )}
          {descRevealed
            ? <p style={{ margin: 0, fontFamily: sans, fontWeight: 600, fontSize: 15, letterSpacing: "-0.03em", color: t.text, lineHeight: 1.35 }}>{bet.description}</p>
            : <p style={{ margin: 0, fontFamily: sans, fontWeight: 600, fontSize: 15, letterSpacing: "-0.03em", lineHeight: 1.35, color: "transparent", background: t.textDim, borderRadius: 3, filter: "blur(6px)", userSelect: "none", pointerEvents: "none" }}>{bet.description.replace(/./g, "█")}</p>
          }
        </div>
        <Pill status={bet.status} dark={dark} />
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={bet.creator_name} size={22} dark={dark} />
          <span style={{ fontFamily: sans, fontSize: 12, color: t.textMid }}>{bet.creator_name}</span>
          <span style={{ fontFamily: sans, fontSize: 12, color: t.textDim }}>puts</span>
          <span style={{ fontFamily: mono, fontSize: 13, color: ACCENT, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}><Coin size={13} />{bet.stake}</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontFamily: sans, fontSize: 12, color: t.textDim }}>odds <span style={{ fontFamily: mono, fontSize: 12, color: t.textMid }}>{bet.odds}:1</span></span>
          <span style={{ fontFamily: sans, fontSize: 12, color: t.textDim }}>pot <span style={{ fontFamily: mono, fontSize: 12, color: t.textMid, display: "inline-flex", alignItems: "center", gap: 2 }}><Coin size={12} />{pot}</span></span>
        </div>
      </div>

      {bet.opponent_name && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={bet.opponent_name} size={22} dark={dark} />
          <span style={{ fontFamily: sans, fontSize: 12, color: t.textMid }}>{bet.opponent_name}</span>
          <span style={{ fontFamily: sans, fontSize: 12, color: t.textDim }}>counters with</span>
          <span style={{ fontFamily: mono, fontSize: 13, color: t.textMid, display: "inline-flex", alignItems: "center", gap: 2 }}><Coin size={13} />{oppCost}</span>
        </div>
      )}

      {bet.winner_name && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, letterSpacing: "0.08em", fontWeight: 700 }}>WINNER</span>
          <span style={{ fontFamily: sans, fontSize: 13, color: t.text, fontWeight: 600 }}>{bet.winner_name}</span>
          <span style={{ fontFamily: mono, fontSize: 13, color: ACCENT, display: "inline-flex", alignItems: "center", gap: 2 }}>+<Coin size={13} />{pot}</span>
        </div>
      )}

      {(canJoin || canSettle || canCancel) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
          {canJoin && (
            <button onClick={() => onJoin(bet)} style={{
              fontFamily: sans, fontSize: 12, fontWeight: 600, background: ACCENT,
              color: "#fff", border: "none", padding: "7px 14px", borderRadius: 4, cursor: "pointer"
            }}>Take bet — put up <Coin size={11} />{oppCost}</button>
          )}
          {canSettle && (<>
            <button onClick={() => onSettle(bet, bet.creator_id, bet.creator_name)} style={{
              fontFamily: sans, fontSize: 12, fontWeight: 600,
              background: t.btnSecBg, color: t.btnSecTxt, border: `1px solid ${t.border2}`,
              padding: "7px 14px", borderRadius: 4, cursor: "pointer"
            }}>{bet.creator_name} won</button>
            <button onClick={() => onSettle(bet, bet.opponent_id, bet.opponent_name)} style={{
              fontFamily: sans, fontSize: 12, fontWeight: 600,
              background: t.btnSecBg, color: t.btnSecTxt, border: `1px solid ${t.border2}`,
              padding: "7px 14px", borderRadius: 4, cursor: "pointer"
            }}>{bet.opponent_name} won</button>
          </>)}
          {canCancel && (
            <button onClick={() => onCancel(bet)} style={{
              fontFamily: sans, fontSize: 12, color: t.textDim, background: "transparent",
              border: `1px solid ${t.border}`, padding: "7px 14px", borderRadius: 4, cursor: "pointer"
            }}>Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  // Auth state
  const [session, setSession] = useState(null); // { token, userId, username }
  const [dark, setDark]       = useState(true);

  // App state
  const [view, setView]         = useState("bets");
  const [bets, setBets]         = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [winnerModal, setWinnerModal] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Create form
  const [form, setForm] = useState({ description: "", stake: 100, odds: 2, secret: false });

  const t = theme(dark);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3200); }

  // Load data after auth
  const loadData = useCallback(async (token, userId) => {
    setLoading(true);
    try {
      const [betsData, profilesData] = await Promise.all([
        getBets(token),
        getAllProfiles(token),
      ]);
      setBets(betsData || []);
      setProfiles(profilesData || []);
      const me = (profilesData || []).find(p => p.id === userId);
      setMyProfile(me || null);
    } catch (e) {
      showToast("Failed to load data: " + e.message);
    }
    setLoading(false);
  }, []);

  function handleAuth(sess) {
    setSession(sess);
    loadData(sess.token, sess.userId);
  }

  async function handleSignOut() {
    if (session) await signOut(session.token).catch(() => {});
    setSession(null);
    setBets([]);
    setProfiles([]);
    setMyProfile(null);
  }

  async function handleCreateBet() {
    const stake = parseInt(form.stake);
    const odds  = parseFloat(form.odds);
    if (!form.description.trim())           return showToast("Write what the bet is about");
    if (stake < 10)                         return showToast("Minimum stake is SV10");
    if ((myProfile?.balance || 0) < stake)  return showToast("Not enough SV coins");
    if (odds < 1 || odds > 20)             return showToast("Odds must be 1–20");

    try {
      const newBet = {
        creator_id: session.userId,
        creator_name: session.username,
        description: form.description.trim(),
        stake, odds,
        status: "open",
        secret: form.secret,
      };
      await createBet(newBet, session.token);
      await updateProfile(session.userId, { balance: myProfile.balance - stake }, session.token);
      setForm({ description: "", stake: 100, odds: 2, secret: false });
      setView("bets");
      showToast(`Bet live — staked SV${stake}`);
      await loadData(session.token, session.userId);
    } catch (e) {
      showToast("Error: " + e.message);
    }
  }

  async function handleJoinBet(bet) {
    const cost = Math.round(bet.stake * bet.odds);
    if ((myProfile?.balance || 0) < cost) return showToast(`Need SV${cost} to join`);
    try {
      await updateBet(bet.id, { status: "matched", opponent_id: session.userId, opponent_name: session.username }, session.token);
      await updateProfile(session.userId, { balance: myProfile.balance - cost }, session.token);
      showToast(`Bet matched. SV${cost} locked in.`);
      await loadData(session.token, session.userId);
    } catch (e) {
      showToast("Error: " + e.message);
    }
  }

  async function handleSettleBet(bet, winnerId, winnerName) {
    const pot = bet.stake + Math.round(bet.stake * bet.odds);
    const loserId   = winnerId === bet.creator_id ? bet.opponent_id : bet.creator_id;
    const winnerProf = profiles.find(p => p.id === winnerId);
    const loserProf  = profiles.find(p => p.id === loserId);
    if (!winnerProf || !loserProf) return showToast("Profile not found");
    try {
      await updateBet(bet.id, { status: "settled", winner_id: winnerId, winner_name: winnerName }, session.token);
      await updateProfile(winnerId, { balance: winnerProf.balance + pot, wins: winnerProf.wins + 1 }, session.token);
      await updateProfile(loserId, { losses: loserProf.losses + 1 }, session.token);
      showToast(`${winnerName} collects SV${pot}`);
      if (winnerId === session.userId) setWinnerModal(true);
      await loadData(session.token, session.userId);
    } catch (e) {
      showToast("Error: " + e.message);
    }
  }

  async function handleCancelBet(bet) {
    const creatorProf = profiles.find(p => p.id === bet.creator_id);
    if (!creatorProf) return;
    try {
      await updateBet(bet.id, { status: "cancelled" }, session.token);
      await updateProfile(bet.creator_id, { balance: creatorProf.balance + bet.stake }, session.token);
      showToast("Bet void. Stake returned.");
      await loadData(session.token, session.userId);
    } catch (e) {
      showToast("Error: " + e.message);
    }
  }

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!session) {
    return <AuthScreen dark={dark} onToggleDark={() => setDark(d => !d)} onAuth={handleAuth} />;
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const balance = myProfile?.balance ?? "…";
  const pnl     = myProfile ? myProfile.balance - STARTING_BALANCE : 0;

  const visibleBets = bets.filter(b => {
    if (filter === "open") return b.status === "open";
    if (filter === "mine") return b.creator_id === session.userId || b.opponent_id === session.userId;
    return true;
  });

  const tabStyle = (v) => ({
    fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em",
    padding: "6px 0", background: "transparent", border: "none", cursor: "pointer",
    color: view === v ? t.text : t.textDim,
    borderBottom: view === v ? `2px solid ${ACCENT}` : "2px solid transparent",
  });

  const filterStyle = (f) => ({
    fontFamily: mono, fontSize: 11, letterSpacing: "0.06em",
    padding: "4px 10px", background: "transparent", cursor: "pointer",
    color: filter === f ? ACCENT : t.textDim,
    border: `1px solid ${filter === f ? ACCENT : t.border}`,
    borderRadius: 3,
  });

  const inputStyle = {
    width: "100%", boxSizing: "border-box", fontFamily: mono, fontSize: 15,
    background: t.inputBg, color: t.inputText, border: `1px solid ${t.border2}`,
    borderRadius: 4, padding: "9px 12px", colorScheme: dark ? "dark" : "light",
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, transition: "background 0.2s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Pixelify+Sans:wght@400;700&display=swap" rel="stylesheet" />

      {winnerModal && <WinnerModal onClose={() => setWinnerModal(false)} />}

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: t.toastBg, border: `1px solid ${t.border2}`, borderRadius: 6,
          padding: "10px 18px", fontFamily: sans, fontSize: 13, fontWeight: 500,
          color: t.toastTxt, zIndex: 999, whiteSpace: "nowrap"
        }}>{toast}</div>
      )}

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <Logo textColor={t.text} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ModeToggle dark={dark} onToggle={() => setDark(d => !d)} />
              <button onClick={handleSignOut} style={{
                fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                color: t.textDim, background: "transparent",
                border: `1px solid ${t.border}`, borderRadius: 3,
                padding: "5px 10px", cursor: "pointer"
              }}>SIGN OUT</button>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: mono, fontSize: 12, color: t.textDim, marginBottom: 2 }}>{session.username}</div>
              <span style={{ fontFamily: mono, fontSize: 22, color: t.text, fontWeight: 700, letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 3 }}><Coin size={22} />{balance}</span>
              {myProfile && (
                <div style={{ fontFamily: mono, fontSize: 11, color: pnl >= 0 ? t.win : t.loss, marginTop: 2 }}>
                  {pnl >= 0 ? "+" : ""}{pnl} vs start
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${t.border}`, marginBottom: "1.5rem" }}>
          <button style={tabStyle("bets")}        onClick={() => setView("bets")}>Bets</button>
          <button style={tabStyle("create")}      onClick={() => setView("create")}>+ New</button>
          <button style={tabStyle("leaderboard")} onClick={() => setView("leaderboard")}>Leaderboard</button>
        </div>

        {/* Bets view */}
        {view === "bets" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
              {["all","open","mine"].map(f => (
                <button key={f} style={filterStyle(f)} onClick={() => setFilter(f)}>
                  {f === "all" ? "ALL" : f === "open" ? "OPEN" : "MINE"}
                </button>
              ))}
              <button onClick={() => loadData(session.token, session.userId)} style={{
                marginLeft: "auto", fontFamily: mono, fontSize: 10, letterSpacing: "0.08em",
                color: t.textDim, background: "transparent", border: `1px solid ${t.border}`,
                borderRadius: 3, padding: "4px 10px", cursor: "pointer"
              }}>↻ REFRESH</button>
            </div>

            {loading
              ? <Spinner dark={dark} />
              : visibleBets.length === 0
                ? <div style={{ padding: "3rem 0", fontFamily: sans, fontSize: 14, color: t.textDim }}>No bets here. Create one.</div>
                : visibleBets.map(bet => (
                    <BetCard key={bet.id} bet={bet}
                      currentUserId={session.userId}
                      currentUsername={session.username}
                      dark={dark}
                      onJoin={handleJoinBet}
                      onSettle={handleSettleBet}
                      onCancel={handleCancelBet}
                    />
                  ))
            }
          </div>
        )}

        {/* Create view */}
        {view === "create" && (
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "1.25rem" }}>
            <label style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>THE BET</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Finn won't finish his pint before midnight"
              rows={3} style={{ ...inputStyle, fontSize: 14, fontFamily: sans, fontWeight: 500, letterSpacing: "-0.02em", resize: "vertical", marginBottom: "1.25rem" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.25rem" }}>
              <div>
                <label style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>YOUR STAKE</label>
                <input type="number" min={10} max={myProfile?.balance || 1000} step={10} value={form.stake}
                  onChange={e => setForm(f => ({ ...f, stake: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>ODDS (X : 1)</label>
                <input type="number" min={1} max={20} step={0.5} value={form.odds}
                  onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <button onClick={() => setForm(f => ({ ...f, secret: !f.secret }))} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: form.secret ? (dark ? "#0d1a3a" : "#e8eeff") : t.btnSecBg,
              border: `1px solid ${form.secret ? ACCENT : t.border}`,
              borderRadius: 4, padding: "10px 14px", marginBottom: "1.25rem",
              cursor: "pointer", width: "100%", textAlign: "left"
            }}>
              <span style={{ fontSize: 16 }}>{form.secret ? "🔒" : "🔓"}</span>
              <div>
                <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: form.secret ? ACCENT : t.textMid }}>
                  {form.secret ? "SECRET BET ON" : "SECRET BET OFF"}
                </div>
                <div style={{ fontFamily: sans, fontSize: 11, color: t.textDim, marginTop: 2 }}>
                  {form.secret ? "Description hidden from everyone until settled" : "Tap to hide the bet description from others"}
                </div>
              </div>
            </button>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 4, padding: "12px 14px", marginBottom: "1.5rem", display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "YOU RISK",  val: parseInt(form.stake) || 0,  color: ACCENT },
                { label: "THEY RISK", val: Math.round((parseInt(form.stake)||0) * (parseFloat(form.odds)||1)), color: t.textMid },
                { label: "TOTAL POT", val: (parseInt(form.stake)||0) + Math.round((parseInt(form.stake)||0) * (parseFloat(form.odds)||1)), color: t.text },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: t.textDim, letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
                  <span style={{ fontFamily: mono, fontSize: 18, color, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><Coin size={18} /><span style={{ color }}>{val}</span></span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCreateBet} style={{
                fontFamily: sans, fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
                background: ACCENT, color: "#fff", border: "none",
                padding: "10px 20px", borderRadius: 4, cursor: "pointer", flex: 1
              }}>Post bet</button>
              <button onClick={() => setView("bets")} style={{
                fontFamily: sans, fontSize: 13, color: t.textMid, background: "transparent",
                border: `1px solid ${t.border}`, padding: "10px 16px", borderRadius: 4, cursor: "pointer"
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Leaderboard view */}
        {view === "leaderboard" && (
          <div>
            {loading ? <Spinner dark={dark} /> : (
              <div style={{ borderTop: `1px solid ${t.border}` }}>
                {profiles.map((profile, i) => {
                  const delta = profile.balance - STARTING_BALANCE;
                  const isMe  = profile.id === session.userId;
                  return (
                    <div key={profile.id} style={{
                      borderBottom: `1px solid ${t.border}`, padding: "14px 0",
                      display: "flex", alignItems: "center", gap: 14,
                      background: isMe ? t.rowHover : "transparent"
                    }}>
                      <span style={{ fontFamily: mono, fontSize: 12, color: i < 3 ? ACCENT : t.textDim, width: 22, textAlign: "center" }}>
                        {["🥇","🥈","🥉"][i] ?? String(i+1).padStart(2,"0")}
                      </span>
                      <Avatar name={profile.username} size={30} dark={dark} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: sans, fontSize: 14, fontWeight: isMe ? 700 : 500, letterSpacing: "-0.025em", color: t.text }}>
                          {profile.username}
                          {isMe && <span style={{ fontFamily: mono, fontSize: 10, color: ACCENT, marginLeft: 8, letterSpacing: "0.08em" }}>YOU</span>}
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 11, color: t.textDim, marginTop: 1 }}>
                          {profile.wins}W / {profile.losses}L
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontFamily: mono, fontSize: 16, color: t.text, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}><Coin size={16} />{profile.balance}</span>
                        <div style={{ fontFamily: mono, fontSize: 11, color: delta >= 0 ? t.win : t.loss, marginTop: 2 }}>
                          {delta >= 0 ? "+" : ""}{delta}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
