const PROFILE_URL = "https://www.moltbook.com/api/v1/agents/profile?name=agentmoltbook";
const POSTS_URL = "https://www.moltbook.com/api/v1/agents/agentmoltbook/posts?limit=6";

const numberValue = (...values) => {
  const value = values.find((candidate) => Number.isFinite(Number(candidate)));
  return value === undefined ? 0 : Number(value);
};

const textValue = (value, maximum = 4000) => typeof value === "string" ? value.slice(0, maximum) : "";

const postList = (payload) => {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload?.posts, payload?.data?.posts, payload?.recent_posts, payload?.recentPosts]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const normalizePost = (post) => ({
  id: textValue(post?.id || post?._id, 160),
  title: textValue(post?.title, 240),
  content: textValue(post?.content || post?.body, 1200),
  submolt: textValue(post?.submolt?.name || post?.submolt_name || post?.submoltName || post?.community, 100),
  score: numberValue(post?.score, post?.upvotes, post?.vote_count),
  comments: numberValue(post?.comment_count, post?.commentCount, post?.comments_count),
  createdAt: textValue(post?.created_at || post?.createdAt, 80),
});

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const headers = { Accept: "application/json", "User-Agent": "PocketFlowOS/1.0" };
    const profileResponse = await fetch(PROFILE_URL, { headers });
    if (!profileResponse.ok) throw new Error(`Moltbook profile returned ${profileResponse.status}`);

    const profilePayload = await profileResponse.json();
    const agent = profilePayload?.agent || profilePayload?.data?.agent || profilePayload?.data || profilePayload;
    let posts = postList(profilePayload);
    if (posts.length === 0) posts = postList(agent);

    if (posts.length === 0) {
      const postsResponse = await fetch(POSTS_URL, { headers });
      if (postsResponse.ok) posts = postList(await postsResponse.json());
    }

    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response.status(200).json({
      profile: {
        name: textValue(agent?.name || "agentmoltbook", 100),
        description: textValue(agent?.description || agent?.bio, 800),
        avatarUrl: textValue(agent?.avatar_url || agent?.avatarUrl, 1000),
        karma: numberValue(agent?.karma),
        followers: numberValue(agent?.follower_count, agent?.followerCount, agent?.followers),
        following: numberValue(agent?.following_count, agent?.followingCount, agent?.following),
        posts: numberValue(agent?.post_count, agent?.postCount, agent?.stats?.posts, posts.length),
        verified: Boolean(agent?.is_verified || agent?.verified || agent?.is_claimed),
      },
      posts: posts.slice(0, 6).map(normalizePost).filter((post) => post.id || post.title || post.content),
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.status(502).json({
      error: "Moltbook is temporarily unavailable",
      detail: error instanceof Error ? error.message : "Unknown upstream error",
    });
  }
}
