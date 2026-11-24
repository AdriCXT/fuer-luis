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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    /* Live-Flugkarte: öffentliche OGN-Daten (Open Glider Network) für Schweinfurt und Umgebung */
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/ogn") {
      const B = { n: 50.65, s: 49.45, e: 11.10, w: 9.35 };
      const out = new Map();
      const put = a => { const k = a.hex || (a.src + a.reg + a.lat); const o = out.get(k); if (!o || a.age < o.age) out.set(k, a); };
      const ogn = fetch(`https://live.glidernet.org/lxml.php?a=1&b=${B.n}&c=${B.s}&d=${B.e}&e=${B.w}&z=1`, { cf: { cacheTtl: 4 } }).then(r => r.text()).then(xml => {
        for (const m of xml.matchAll(/<m a="([^"]+)"/g)) {
          const f = m[1].split(","), age = +f[6];
          if (!(age <= 3600)) continue;
          put({ src: "OGN", hex: (f[12] && f[12] !== "0") ? f[12].toLowerCase() : "", lat: +f[0], lon: +f[1], cn: f[2], reg: f[3], alt: +f[4], age, trk: +f[7], spd: +f[8], vs: +f[9], type: +f[10], rx: f[11] });
        }
      }).catch(() => {});
      const adsb = fetch("https://api.adsb.lol/v2/point/50.05/10.23/45", { cf: { cacheTtl: 4 } }).then(r => r.json()).then(j => {
        const cat = c => c === "B1" ? 1 : c === "A7" ? 3 : c === "A1" ? 8 : c === "B2" ? 11 : c === "B6" ? 13 : /^A[2-6]$/.test(c || "") ? 9 : 0;
        for (const a of (j.ac || [])) {
          if (typeof a.lat !== "number") continue;
          const alt = typeof a.alt_baro === "number" ? a.alt_baro * 0.3048 : (a.alt_geom || 0) * 0.3048;
          put({ src: "ADS-B", hex: a.hex, lat: a.lat, lon: a.lon, cn: (a.flight || "").trim(), reg: a.r || (a.flight || "").trim() || a.hex, model: a.t || "", alt, age: Math.round(a.seen_pos ?? a.seen ?? 0), trk: a.track || a.true_heading || 0, spd: (a.gs || 0) * 1.852, vs: (a.baro_rate || 0) * 0.00508, type: cat(a.category), ground: a.alt_baro === "ground" });
        }
      }).catch(() => {});
      await Promise.all([ogn, adsb]);
      return new Response(JSON.stringify({ t: Date.now(), list: [...out.values()] }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "max-age=4" } });
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
        web_url: (/^https:\/\/adricxt\.github\.io\/[a-z0-9-]{1,40}\/$/.test(b.site || "") ? b.site : (env.SITE || ORIGIN)) + (b.heart ? "" : b.kind === "letter" ? "#m7" : "#m8")
      })
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
  }
};
