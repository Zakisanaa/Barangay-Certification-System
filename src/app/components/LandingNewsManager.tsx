import { useEffect, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getPublicPosts, PostType, PublicPost, savePublicPosts, subscribePublicPosts } from "../portalData";

const emptyDraft = { title: "", content: "", type: "NOTICE" as PostType };

export default function LandingNewsManager() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const loaded = await getPublicPosts();
        if (active) setPosts(loaded);
      } catch (error) {
        console.error("Unable to load landing page announcements.", error);
        if (active) toast.error(error instanceof Error ? error.message : "Could not load announcements.");
      }
    };
    void refresh();
    const unsubscribe = subscribePublicPosts(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const updatePosts = async (nextPosts: PublicPost[]) => {
    await savePublicPosts(nextPosts);
    setPosts(nextPosts);
  };

  const submitPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPosts = editingId
      ? posts.map((post) => post.id === editingId
        ? { ...post, ...draft, publishedAt: new Date().toISOString() }
        : post)
      : [{
        id: globalThis.crypto?.randomUUID?.() ?? `post-${Date.now()}`,
        ...draft,
        publishedAt: new Date().toISOString(),
        archived: false,
      }, ...posts];

    try {
      await updatePosts(nextPosts);
      setDraft(emptyDraft);
      setEditingId(null);
      toast.success("Announcement saved to the shared database.");
    } catch (error) {
      console.error("Unable to save announcement.", error);
      toast.error(error instanceof Error ? error.message : "Could not save announcement.");
    }
  };

  const beginEdit = (post: PublicPost) => {
    setEditingId(post.id);
    setDraft({ title: post.title, content: post.content, type: post.type });
  };

  const visiblePosts = posts.filter((post) => post.archived === showArchived);

  return (
    <section className="space-y-5 bg-white p-4 md:p-6" style={{ border: "1px solid #c4c0b9" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-[#122d1f]">Landing page news</h3>
          <p className="mt-1 text-sm text-[#53645b]">Create and update public announcements. Archived posts can be restored.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowArchived((value) => !value)}
          className="flex min-h-11 items-center gap-2 border border-[#c9d1ca] px-4 text-sm font-bold text-[#123323]"
        >
          {showArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {showArchived ? "View published" : "View archived"}
        </button>
      </div>

      <form onSubmit={submitPost} className="grid gap-4 border border-[#d7ddd7] bg-[#f7faf7] p-4 md:grid-cols-2">
        <h4 className="text-base font-bold text-[#122d1f] md:col-span-2">
          {editingId ? "Edit announcement" : "Add an announcement"}
        </h4>
        <label className="grid gap-1.5 text-sm font-semibold text-[#34483a]">
          Title
          <input
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            className="min-h-11 border border-[#c9d1ca] bg-white px-3 text-base"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-[#34483a]">
          Type
          <select
            value={draft.type}
            onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as PostType }))}
            className="min-h-11 border border-[#c9d1ca] bg-white px-3 text-base"
          >
            <option value="NOTICE">Notice</option>
            <option value="ADVISORY">Advisory</option>
            <option value="UPDATE">Update</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-[#34483a] md:col-span-2">
          Announcement details
          <textarea
            required
            rows={4}
            maxLength={1000}
            value={draft.content}
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            className="border border-[#c9d1ca] bg-white p-3 text-base"
          />
        </label>
        <div className="flex gap-2 md:col-span-2">
          <button type="submit" className="flex min-h-11 items-center gap-2 bg-[#123323] px-5 text-sm font-bold text-white">
            <Plus className="h-4 w-4" /> {editingId ? "Save changes" : "Publish announcement"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setDraft(emptyDraft); }}
              className="min-h-11 border border-[#c9d1ca] px-5 text-sm font-bold text-[#123323]"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="divide-y divide-[#e3e8e3] border border-[#d7ddd7]">
        {visiblePosts.length ? visiblePosts.map((post) => (
          <article key={post.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-[#53645b]">
                <span className="font-bold text-[#123323]">{post.type}</span>
                <time dateTime={post.publishedAt}>{format(new Date(post.publishedAt), "MMM d, yyyy")}</time>
              </div>
              <h4 className="text-lg font-bold text-[#122d1f]">{post.title}</h4>
              <p className="mt-1 max-w-3xl text-base leading-relaxed text-[#53645b]">{post.content}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {!showArchived && (
                <button
                  type="button"
                  onClick={() => beginEdit(post)}
                  className="flex min-h-10 items-center gap-2 border border-[#c9d1ca] px-3 text-sm font-semibold"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => void updatePosts(posts.map((item) =>
                  item.id === post.id ? { ...item, archived: !item.archived } : item
                )).catch((error: unknown) => {
                  console.error("Unable to archive announcement.", error);
                  toast.error(error instanceof Error ? error.message : "Could not archive announcement.");
                })}
                className="flex min-h-10 items-center gap-2 border border-[#c9d1ca] px-3 text-sm font-semibold"
              >
                {showArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {showArchived ? "Restore" : "Archive"}
              </button>
            </div>
          </article>
        )) : (
          <p className="p-5 text-base text-[#53645b]">
            {showArchived ? "No archived announcements." : "No published announcements yet."}
          </p>
        )}
      </div>
      <p className="text-sm text-[#53645b]">
        Published announcements are synchronized through the shared Supabase database.
      </p>
    </section>
  );
}
