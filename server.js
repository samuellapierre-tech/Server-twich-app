import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ À configurer dans Render (Environment variables)
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

/* ============================================================
   🔥 LISTE DES CHAÎNES
   facteurgeek est AJOUTÉ EN DERNIER
============================================================ */
const CHANNELS = [
  "valiv2",          
  "crackthecode1",   
  "whiteshad0wz1989",
  "lyvickmax",
  "skyrroztv",
  "cohhcarnage",
  "lvndmark",
  "eslcs",
  "explorajeux",
  "lesfaineants",
  "dacemaster",
  "facteurgeek"        // ⭐ en dernier dans la liste
];

let accessToken = null;
let tokenExpiresAt = 0;

// Récupérer un token Twitch (client_credentials)
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiresAt) return accessToken;

  const params = new URLSearchParams();
  params.append("client_id", TWITCH_CLIENT_ID);
  params.append("client_secret", TWITCH_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("❌ Erreur JSON token Twitch:", text);
    throw new Error("Réponse invalide de Twitch pour le token");
  }

  if (!res.ok) {
    console.error("❌ Erreur token Twitch:", data);
    throw new Error(data.message || "Impossible d'obtenir le token Twitch");
  }

  accessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;

  return accessToken;
}

// Retourne la liste des chaînes qui sont live (en minuscules)
async function getLiveStatus() {
  const token = await getAccessToken();

  const params = new URLSearchParams();
  CHANNELS.forEach(c => params.append("user_login", c));

  const res = await fetch(
    "https://api.twitch.tv/helix/streams?" + params.toString(),
    {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${token}`,
      }
    }
  );

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("❌ Erreur JSON Twitch /streams:", text);
    return [];
  }

  if (!res.ok) {
    console.error("❌ Erreur Twitch /streams:", data);
    return [];
  }

  if (!data || !Array.isArray(data.data)) {
    console.error("❌ Format inattendu Twitch /streams:", data);
    return [];
  }

  return data.data.map(s => s.user_login.toLowerCase());
}

/* ============================================================
   ROUTE : /live-order
   RÈGLE :
   - facteurgeek est toujours #1 s'il est live
   - sinon vali (#2)
   - sinon live en ordre naturel, puis offline
============================================================ */
app.get("/live-order", async (req, res) => {
  try {
    const liveList = await getLiveStatus(); // ex: ["valiv2","facteurgeek"]

    const live = [];
    const offline = [];

    for (const ch of CHANNELS) {
      if (liveList.includes(ch.toLowerCase())) live.push(ch);
      else offline.push(ch);
    }

    const fg = "facteurgeek";
    const vali = "valiv2";

    let ordered = [];

    if (liveList.includes(fg.toLowerCase())) {
      // ⭐ FACTEURGEEK = #1 ABSOLU
      ordered = [
        fg,
        ...live.filter(c => c.toLowerCase() !== fg.toLowerCase()),
        ...offline.filter(c => c.toLowerCase() !== fg.toLowerCase())
      ];
    } else if (liveList.includes(vali.toLowerCase())) {
      // ⭐ Vali est #1 seulement si FG n'est pas live
      ordered = [
        vali,
        ...live.filter(c => c.toLowerCase() !== vali.toLowerCase()),
        ...offline.filter(c => c.toLowerCase() !== vali.toLowerCase())
      ];
    } else {
      // Aucun FG/Vali → live en premier, offline ensuite
      ordered = [...live, ...offline];
    }

    res.json({ ordered, live: liveList });

  } catch (err) {
    console.error("❌ Erreur /live-order:", err);
    res.status(500).json({
      error: "API error",
      detail: err.message || String(err)
    });
  }
});

// Route simple de test
app.get("/", (req, res) => {
  res.send("CrackTheCode Twitch API OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port " + PORT));
