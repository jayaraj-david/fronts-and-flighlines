// Vercel serverless function: pulls defence headlines from Google News RSS and PIB, returns JSON.
// Cached at Vercel's edge for 30 minutes, so feeds are hit at most a couple of times an hour.
const FEEDS = [
  { tag: "iaf", url: "https://news.google.com/rss/search?q=%22Indian+Air+Force%22+when:7d&hl=en-IN&gl=IN&ceid=IN:en" },
  { tag: "defence", url: "https://news.google.com/rss/search?q=%22Ministry+of+Defence%22+OR+%22Indian+Army%22+OR+%22Indian+Navy%22+OR+%22Rajnath+Singh%22+when:7d&hl=en-IN&gl=IN&ceid=IN:en" },
  { tag: "drdo", url: "https://news.google.com/rss/search?q=DRDO+OR+HAL+OR+%22Tejas%22+OR+%22BrahMos%22+when:7d&hl=en-IN&gl=IN&ceid=IN:en" },
];

// Drop stock-market and investing stories that mention HAL, BEL and others.
const NOISE = /\b(stocks?|shares?|share price|sensex|nifty|largecap|midcap|smallcap|multibagger|target price|dividend|ipo|portfolio|investors?|brokerage|q[1-4] results)\b/i;

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
}
function pick(block, tag) {
  const m = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">"));
  return m ? decode(m[1]) : "";
}

async function readFeed(feed) {
  const r = await fetch(feed.url, { headers: { "User-Agent": "Mozilla/5.0 (FrontsAndFlightlines news reader)" } });
  if (!r.ok) return [];
  const xml = await r.text();
  const items = xml.split("<item>").slice(1).map(b => b.split("</item>")[0]);
  return items.map(b => {
    let title = pick(b, "title");
    const source = pick(b, "source");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    return { title, link: pick(b, "link"), source, date: pick(b, "pubDate"), tag: feed.tag };
  }).filter(i => i.title && i.link && !NOISE.test(i.title));
}

module.exports = async (req, res) => {
  try {
    const lists = await Promise.all(FEEDS.map(f => readFeed(f).catch(() => [])));
    const seen = new Set();
    const all = [];
    for (const list of lists) {
      for (const it of list) {
        const key = it.title.toLowerCase().slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(it);
      }
    }
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), items: all.slice(0, 60) }));
  } catch (e) {
    res.status(500).json({ error: "Could not load news right now." });
  }
};
