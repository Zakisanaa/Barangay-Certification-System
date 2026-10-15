import { useState } from "react";
import type { PublicPost } from "../portalData";
import { getAnnouncementImageUrl } from "../announcementImages";

export default function AnnouncementImage({ post }: { post: PublicPost }) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const url = getAnnouncementImageUrl(post.imagePath);
  if (!url) return null;
  if (failedPath === post.imagePath) return <p className="mt-3 text-sm text-[#53645b]">Photo unavailable. Please read the announcement details above.</p>;
  return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open full photo for ${post.title}`} className="mt-3 block rounded border border-[#d7ddd7] bg-[#f7faf7] focus-visible:outline-2 focus-visible:outline-[#123323]">
    <img src={url} alt={post.imageAlt || `Photo for ${post.title}`} loading="lazy" onError={() => setFailedPath(post.imagePath ?? null)} className="max-h-[480px] w-full rounded object-contain" />
    <span className="block px-3 py-2 text-sm font-semibold text-[#123323]">View full photo</span>
  </a>;
}
