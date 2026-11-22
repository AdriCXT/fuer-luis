/* Cloudflare Worker: nimmt Meldungen von der Website an und schickt sie
   über OneSignal als Push-Mitteilung an das Handy des anderen.
   Der geheime OneSignal-Schlüssel bleibt hier und ist auf der Website nicht sichtbar.

   Benötigte Variablen (Cloudflare → Worker → Settings → Variables and Secrets):
     ONESIGNAL_APP_ID   – OneSignal App ID                  (Text)
     ONESIGNAL_KEY      – OneSignal REST API Key             (Secret!)
     ROOM               – derselbe Raum-Name wie in index.html (Text)
     SITE               – https://adricxt.github.io/website-fuer-luis/   (Text)
     NAME_OWNER         – Adrian   (optional)
     NAME_GUEST         – Luis     (optional)
*/
const ORIGIN = "https://adricxt.github.io";
const recent = new Map();   // einfache Bremse gegen Spam (pro Worker-Instanz)

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("Push-Relay läuft ✓", { headers: cors });

    let b;
    try { b = await req.json(); } catch { return new Response("bad request", { status: 400, headers: cors }); }
    if (!b || b.room !== env.ROOM || !["owner", "guest"].includes(b.from)) {
      return new Response("forbidden", { status: 403, headers: cors });
    }

    // max. 1 Mitteilung alle 3 Sekunden pro Absender
    const now = Date.now(), last = recent.get(b.from) || 0;
    if (now - last < 3000) return new Response("zu schnell", { status: 429, headers: cors });
    recent.set(b.from, now);

    const NAMES = { owner: env.NAME_OWNER || "Adrian", guest: env.NAME_GUEST || "Luis" };
    const who = NAMES[b.from], to = b.from === "owner" ? "guest" : "owner";

    let title, body;
    if (b.heart)                 { title = `${who} denkt an dich 💚`;        body = "Tipp, um ein Herz zurückzuschicken."; }
    else if (b.kind === "letter"){ title = `${who} hat einen Brief geöffnet ✉️`; body = "Öffnen, " + String(b.text || "").slice(0, 80); }
    else if (b.kind === "draw")  { title = `${who} hat dir etwas gemalt 🎨`; body = "Schau ins Notenblatt."; }
    else                         { title = `${who} hat dir geschrieben ♪`;   body = String(b.text || "").slice(0, 140) || "Schau ins Notenblatt."; }

    const r = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Key " + env.ONESIGNAL_KEY },
      body: JSON.stringify({
        app_id: env.ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: [env.ROOM + "-" + to] },
        headings: { en: title, de: title },
        contents: { en: body, de: body },
        web_url: (env.SITE || ORIGIN) + (b.heart ? "" : b.kind === "letter" ? "#m7" : "#m8")
      })
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
  }
};
