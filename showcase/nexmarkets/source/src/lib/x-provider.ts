import { decryptSecret } from "./secrets";

export type XUser = { id: string; name: string; username: string; profile_image_url?: string; location?: string; description?: string; created_at?: string; public_metrics?: Record<string, number> };
type XTweet = { id: string; text: string; created_at?: string; public_metrics?: Record<string, number>; entities?: { urls?: { expanded_url?: string }[]; hashtags?: { tag: string }[] } };

async function xFetch<T>(path: string, accessTokenEncrypted: string) {
  const response = await fetch(`https://api.x.com/2${path}`, { headers: { authorization: `Bearer ${decryptSecret(accessTokenEncrypted)}`, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({})) as { data?: T; errors?: { detail?: string; message?: string }[] };
  if (!response.ok || !payload.data) throw new Error(payload.errors?.[0]?.detail || payload.errors?.[0]?.message || `X API returned HTTP ${response.status}.`);
  return payload.data;
}

export function getXMe(accessTokenEncrypted: string) {
  return xFetch<XUser>("/users/me?user.fields=created_at,description,location,profile_image_url,public_metrics,verified", accessTokenEncrypted);
}

export function getXTweets(userId: string, accessTokenEncrypted: string) {
  return xFetch<XTweet[]>(`/users/${encodeURIComponent(userId)}/tweets?max_results=100&exclude=retweets&tweet.fields=created_at,public_metrics,entities`, accessTokenEncrypted);
}

const stopWords = new Set("about after again also among because been before being between both could does doing down during each from further have having here into itself just more most other over same should some such than that their theirs them then there these they this those through under very what when where which while will with would your yours".split(" "));
export function analyseXTweets(tweets: XTweet[]) {
  const now = Date.now();
  const windowDays = 90;
  const cutoff = now - windowDays * 24 * 60 * 60 * 1_000;
  const analysedTweets = tweets.filter((tweet) => {
    const timestamp = tweet.created_at ? Date.parse(tweet.created_at) : Number.NaN;
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
  });
  const totals = { impressions: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 };
  const terms = new Map<string, number>();
  const days = new Set<string>();
  const weeklyReach = Array.from({ length: 13 }, () => 0);
  for (const tweet of analysedTweets) {
    const metrics = tweet.public_metrics || {};
    totals.impressions += metrics.impression_count || 0; totals.likes += metrics.like_count || 0; totals.replies += metrics.reply_count || 0;
    totals.reposts += metrics.retweet_count || 0; totals.quotes += metrics.quote_count || 0;
    if (tweet.created_at) {
      days.add(tweet.created_at.slice(0, 10));
      const ageDays = Math.max(0, Math.floor((now - Date.parse(tweet.created_at)) / (24 * 60 * 60 * 1_000)));
      const chronologicalIndex = 12 - Math.min(12, Math.floor(ageDays / 7));
      weeklyReach[chronologicalIndex] += metrics.impression_count || 0;
    }
    const hashtags = tweet.entities?.hashtags?.map((item) => item.tag.toLowerCase()) || [];
    const words = tweet.text.toLowerCase().replace(/https?:\/\/\S+/g, " ").match(/[a-z][a-z0-9-]{3,}/g) || [];
    for (const term of [...hashtags, ...words]) if (!stopWords.has(term)) terms.set(term, (terms.get(term) || 0) + 1);
  }
  const topics = [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  const standout = [...analysedTweets].sort((a, b) => {
    const score = (tweet: XTweet) => Object.values(tweet.public_metrics || {}).reduce((sum, value) => sum + value, 0);
    return score(b) - score(a);
  }).slice(0, 5).map((tweet) => ({ id: tweet.id, text: tweet.text, createdAt: tweet.created_at, metrics: tweet.public_metrics, url: tweet.entities?.urls?.[0]?.expanded_url }));
  return { windowDays, tweetsChecked: analysedTweets.length, activeDays: days.size, totals, topics, standout, weeklyReach, analysedAt: new Date().toISOString() };
}
