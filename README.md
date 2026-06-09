# 🍜 Nom Nom — Couples Dinner Decider

> Swipe together. Eat together.

A real-time multiplayer swipe app for couples who can never agree on where to eat. Both partners swipe yes/no on real nearby restaurants — when you both like the same place, it's a match!

---

## Features

- 🗺️ **Real nearby restaurants** via Google Maps Places API (New)
- 🔄 **Real-time sync** via Firebase Realtime Database
- 📱 **Touch + drag** swipe cards with LIKE / NOPE stamps
- 🎉 **Match screen** with confetti + instant Google Maps directions
- 🌙 **Dark mode** auto-detected
- ⚡ **Entirely free** to run (within Google's $200/month credit + Firebase Spark plan)

---

## Tech Stack

| Layer | Tech | Cost |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (ES modules) | Free |
| Real-time sync | Firebase Realtime Database (Spark plan) | Free up to 1 GB |
| Restaurant data | Google Maps Places API (New) | ~$0.032/request, $200 free credit/month |
| Hosting | Any static host (Vercel, Netlify, GitHub Pages) | Free |

---

## Setup

### 1. Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g. `dinner-decider`)
3. Enable **Places API (New)** — search for it in the API Library
4. Go to **APIs & Services → Credentials → Create Credentials → API Key**
5. Restrict the key:
   - Application restrictions → HTTP referrers → add `localhost/*` and your future domain
   - API restrictions → restrict to **Places API (New)** only
6. Add a billing account (required by Google, but you get $200 free credit/month — more than enough for personal use)

### 2. Firebase Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (use the **Spark (free) plan**)
3. Go to **Build → Realtime Database → Create database**
4. Start in **test mode** (or set rules — see below)
5. Copy your Firebase config from **Project Settings → Your apps → Web app**

Update `index.html` with your config:

```js
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

#### Recommended Firebase Rules

In Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        ".indexOn": ["created"]
      }
    }
  }
}
```

> Rooms older than 24 hours can be cleaned up with a simple Cloud Function (optional).

### 3. Run locally

Since this uses ES modules, you need a local HTTP server (not `file://`):

```bash
# Option A — Python (no install needed)
cd dinner-decider
python3 -m http.server 3000

# Option B — Node (if you have it)
npx serve .

# Option C — VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Deploy (optional)

#### Vercel (recommended, free)
```bash
npm install -g vercel
vercel
```

#### Netlify
Drag and drop the `dinner-decider` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

#### GitHub Pages
Push to a repo, go to Settings → Pages → Deploy from branch.

---

## How to Use

1. **Person A** opens the app, enters their name, taps **Create room**
2. **Person A** shares the 4-letter room code with their partner
3. **Person B** enters their name + room code, taps **Join room**
4. Once both are connected, **Person A** selects cuisine filter + radius and taps **Find restaurants**
5. Both swipe independently — ♥ to like, ✕ to pass (or drag the card!)
6. When both finish, the app finds mutual likes → shows the match with directions 🎉

---

## Project Structure

```
dinner-decider/
├── index.html          # Entry point + Firebase init
├── css/
│   └── style.css       # All styles (dark mode included)
├── js/
│   ├── app.js          # Main app logic, screens, swipe engine
│   ├── places.js       # Google Maps Places API (New) wrapper
│   └── sync.js         # Firebase Realtime Database helpers
└── README.md
```

---

## Cost Estimate

For a couple using this a few times a week:

| Action | API calls | Cost |
|---|---|---|
| Find restaurants (1 session) | 1 Nearby Search call | ~$0.032 |
| Restaurant photos (8 cards × 2 people) | 8 Photo requests | ~$0.056 |
| **Per session total** | | **~$0.09** |
| **Monthly (10 sessions)** | | **~$0.90** |
| **Google free credit** | | **$200/month** |

**Bottom line: effectively free for personal use.**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Places API error 403" | Check your API key is correct and Places API (New) is enabled |
| "Location access denied" | Allow location in your browser settings |
| "Room not found" | Make sure both people are on the same URL/domain |
| Photos not loading | Check your API key has Places API (New) enabled (not the legacy Places API) |
| Can't open `index.html` directly | Use a local server (see step 3 above) — ES modules require HTTP |
