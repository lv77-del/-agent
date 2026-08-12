export type UnsplashAsset = {
  id: string;
  sourceUrl: string;
  altText: string;
  authorName: string;
  authorUrl: string;
  metadata: Record<string, unknown>;
};

export async function searchUnsplash(query: string, count: number) {
  const requested = Math.max(0, Math.min(5, Math.floor(count)));
  if (!requested) return { assets: [] as UnsplashAsset[], warning: null as string | null };
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return {
      assets: [] as UnsplashAsset[],
      warning: "未配置 UNSPLASH_ACCESS_KEY，本次文章已生成，但没有自动配图。",
    };
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query || "artificial intelligence workplace");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", String(requested));
  url.searchParams.set("content_filter", "high");
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Unsplash 搜图失败（HTTP ${response.status}）`);
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results.slice(0, requested) : [];

  await Promise.allSettled(
    results.map((item: any) => {
      if (!item?.links?.download_location) return Promise.resolve();
      const trackUrl = new URL(item.links.download_location);
      trackUrl.searchParams.set("client_id", accessKey);
      return fetch(trackUrl, { signal: AbortSignal.timeout(10_000) });
    }),
  );

  const assets: UnsplashAsset[] = results
    .filter((item: any) => item?.id && item?.urls?.regular)
    .map((item: any) => ({
      id: String(item.id),
      sourceUrl: String(item.urls.regular),
      altText: String(item.alt_description || item.description || query || "文章配图"),
      authorName: String(item.user?.name || "Unsplash"),
      authorUrl: String(item.user?.links?.html || "https://unsplash.com"),
      metadata: {
        unsplashId: item.id,
        width: item.width,
        height: item.height,
        color: item.color,
        downloadLocation: item.links?.download_location,
      },
    }));
  return {
    assets,
    warning: assets.length < requested ? `Unsplash 仅返回 ${assets.length} 张可用图片。` : null,
  };
}
