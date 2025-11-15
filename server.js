import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const CHANNELS = [
  "valiv2",
  "skyrroztv",
  "cohhcarnage",
  "whiteshad0wz1989",
  "lvndmark",
  "crackthecode1"
];

let accessToken = null;
let tokenExpiresAt = 0;

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

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;

  return accessToken;
}

async function getLiveStatus() {
  const token = await getAccessToken();

  const params = new URLSearchParams();
  CHANNELS.forEach(c => params.append("user_login", c));

  const res = await fetch("https://api.twitch.tv/helix/streams?" + params.toString(), {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
    }
  });

  const data = await res.json();
  return data.data.map(s => s.user_login.toLowerCase());
}

app.get("/live-order", async (req, res) => {
  try {
    const liveList = await getLiveStatus();

    const live = [];
    const offline = [];

    for (const ch of CHANNELS) {
      if (liveList.includes(ch.toLowerCase())) live.push(ch);
      else offline.push(ch);
    }

    const vali = "valiv2";
    const liveNoVali = live.filter(c => c !== vali);

    let ordered = [];

    if (liveList.includes(vali)) {
      ordered = [vali, ...liveNoVali, ...offline];
    } else {
      ordered = [...live, ...offline];
    }

    res.json({ ordered, live: liveList });
  } catch (err) {
    res.status(500).json({ error: "API error", detail: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("CrackTheCode Twitch API OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port " + PORT));