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
    /* Live-Flugkarte: öffentliche OGN-Daten (Open Glider Network) für Schweinfurt und Umgebung */
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/ogn") {
      const B = { n: 50.65, s: 49.45, e: 11.10, w: 9.35 };
      try {
        const r = await fetch(`https://live.glidernet.org/lxml.php?a=1&b=${B.n}&c=${B.s}&d=${B.e}&e=${B.w}&z=1`, { cf: { cacheTtl: 15 } });
        const xml = await r.text();
        const out = [];
        for (const m of xml.matchAll(/<m a="([^"]+)"/g)) {
          const f = m[1].split(",");
          const age = +f[6];
          if (!(age <= 3600)) continue;
          out.push({ lat: +f[0], lon: +f[1], cn: f[2], reg: f[3], alt: +f[4], age, trk: +f[7], spd: +f[8], vs: +f[9], type: +f[10], rx: f[11] });
        }
        return new Response(JSON.stringify({ t: Date.now(), list: out }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "max-age=15" } });
      } catch (e) {
        return new Response(JSON.stringify({ t: Date.now(), list: [], error: true }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
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
