# Push-Mitteilungen mit OneSignal (ca. 20–30 Min.)

Danach bekommt ihr eine Mitteilung aufs Handy, wenn der andere eine Notiz schreibt,
etwas malt oder ein 💚 schickt – auch wenn die Seite geschlossen ist.

**So funktioniert's:**
Website → *Cloudflare Worker* (hält den geheimen Schlüssel) → *OneSignal* → Handy

Alles kostenlos, **keine Kreditkarte** nötig.
Im Repo liegt schon alles für die Website (`push/onesignal/OneSignalSDKWorker.js`, Manifest, Icon).
Du brauchst nur zwei Konten und musst mir am Ende **2 Werte** schicken.

---

## 1 · OneSignal einrichten (ca. 10 Min.)

1. Auf **onesignal.com** kostenloses Konto anlegen
2. **New App/Website** → Name: `Für Luis` → Plattform **Web** wählen
3. Integration: **„Custom Code“** auswählen (nicht „Typical Site“, nicht WordPress)
4. **Site Name:** `Für Luis`
   **Site URL:** `https://adricxt.github.io` ← *nur* die Domain, ohne `/website-fuer-luis`
5. Icon hochladen (optional): `icons/icon-512.png` aus dem Repo
6. Speichern. Den Code-Schnipsel, den OneSignal danach zeigt, **brauchst du nicht** – den habe ich schon eingebaut.
7. Oben **Settings → Keys & IDs** öffnen und zwei Werte notieren:
   - **OneSignal App ID** (z. B. `a1b2c3d4-…`)
   - **REST API Key** → ggf. „Create API Key“ klicken und den Schlüssel kopieren (beginnt mit `os_v2_…`)

> ⚠️ Der **REST API Key ist geheim** – nicht in die Website und nicht in den Chat schreiben.
> Er kommt nur in Cloudflare (Schritt 2).

## 2 · Cloudflare Worker anlegen (ca. 10 Min.)

1. Auf **dash.cloudflare.com** kostenloses Konto anlegen (keine Karte nötig)
2. Links **Workers & Pages** → **Create** → **Create Worker** (Vorlage „Hello World“)
3. Name: `fuer-luis-push` → **Deploy**
4. **Edit code** → alles löschen → den kompletten Inhalt von
   **`push/cloudflare-worker.js`** aus dem Repo einfügen → **Deploy**
5. Zurück zum Worker → **Settings → Variables and Secrets → Add**:

   | Name | Typ | Wert |
   |---|---|---|
   | `ONESIGNAL_APP_ID` | Text | deine App ID aus Schritt 1 |
   | `ONESIGNAL_KEY` | **Secret** | dein REST API Key aus Schritt 1 |
   | `ROOM` | Text | (derselbe Raum-Name wie in der Seite) |
   | `SITE` | Text | `https://adricxt.github.io/website-fuer-luis/` |

   → **Deploy** bzw. speichern
6. Oben steht die Adresse des Workers, z. B.
   `https://fuer-luis-push.DEINNAME.workers.dev`
   Öffnest du sie im Browser, steht dort **„Push-Relay läuft ✓“**.

## 3 · Mir 2 Werte schicken

- die **OneSignal App ID**
- die **Worker-Adresse** (`https://fuer-luis-push….workers.dev`)

Beides ist unkritisch und darf öffentlich sein. Ich trage es in die Website ein.
*(Oder selbst: in `index.html` die Zeilen `const ONESIGNAL_APP_ID = "";` und `const PUSH_RELAY = "";` ausfüllen.)*

---

## 4 · Am Handy einschalten (jeder auf seinem Handy)

Vorher im **Notenblatt** einmal „Ich bin: **Adrian** / **Luis**“ antippen.

**iPhone (ab iOS 16.4)** – Apple erlaubt Web-Push nur für installierte Web-Apps:
1. Seite in **Safari** öffnen → unten **Teilen** → **„Zum Home-Bildschirm“**
2. Die Seite **über das neue Symbol** (grün mit goldenem L) öffnen
3. Entsperren → ☰ → **„🔔 Mitteilungen aktivieren“** → **Erlauben**

**Android:**
1. Seite in Chrome öffnen → Entsperren → ☰ → **„🔔 Mitteilungen aktivieren“** → **Erlauben**

Danach steht dort **„🔔 Mitteilungen sind an“**.

## Testen

Einer schickt ein 💚 oder schreibt eine Notiz → beim anderen erscheint z. B.
**„Adrian denkt an dich 💚“**. Antippen öffnet die Seite.

**Bonus:** Im OneSignal-Dashboard unter **Messages → New Push** kannst du Luis auch
von Hand eine Mitteilung schicken – z. B. an Heiligabend „🎄 Schau mal auf deine Seite!“.
Unter **Audience → Subscriptions** siehst du, welche Geräte angemeldet sind.

## Wenn's nicht klappt

- **iPhone: nichts passiert beim Antippen** → Seite muss vom Home-Bildschirm-Symbol geöffnet sein.
- **Mitteilung kommt nicht an** → Cloudflare → Worker → **Logs** (Live): steht dort ein Fehler von OneSignal?
  Häufig: `ONESIGNAL_KEY` falsch oder als Text statt Secret vergessen.
- **„forbidden“** → `ROOM` im Worker stimmt nicht mit `index.html` überein.
- In OneSignal unter **Audience → Subscriptions** prüfen, ob beide Handys mit External ID
  `luis-…-owner` bzw. `luis-…-guest` auftauchen.
