import { useEffect, useRef, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getPublicPosts, PostType, PublicPost, savePublicPost, setPublicPostArchived, subscribePublicPosts } from "../portalData";
import { getAnnouncementImageUrl, removeAnnouncementImage, uploadAnnouncementImage, validateAnnouncementImage } from "../announcementImages";
import AnnouncementImage from "./AnnouncementImage";

const emptyDraft = { title: "", content: "", type: "NOTICE" as PostType, imagePath: null as string | null, imageAlt: "" };

export default function LandingNewsManager() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const inputClass = "min-h-11 w-full rounded border border-[#c9d1ca] bg-white px-3 py-2 text-base";

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const loaded = await getPublicPosts(); if (active) { setPosts(loaded); setLoadError(""); } }
      catch (cause) { if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load announcements."); }
    };
    void refresh();
    const unsubscribe = subscribePublicPosts(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const reset = () => { setDraft(emptyDraft); setEditingId(null); setFile(null); if (fileInput.current) fileInput.current.value = ""; };
  const submitPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current || validating || !draft.title.trim() || !draft.content.trim()) return;
    lock.current = true; setBusy(true);
    const previous = posts.find(post => post.id === editingId);
    const id = editingId ?? crypto.randomUUID();
    let uploadedPath: string | null = null;
    let saved = false;
    try {
      if (file) uploadedPath = await uploadAnnouncementImage(id, file);
      const next: PublicPost = { ...draft, title: draft.title.trim(), content: draft.content.trim(), id,
        imagePath: uploadedPath ?? draft.imagePath, imageAlt: draft.imageAlt.trim(),
        archived: previous?.archived ?? false, publishedAt: previous?.publishedAt ?? new Date().toISOString() };
      await savePublicPost(next); saved = true;
      setPosts(current => [next, ...current.filter(post => post.id !== id)]);
      reset(); toast.success("Announcement saved.");
      if (previous?.imagePath && previous.imagePath !== next.imagePath) await removeAnnouncementImage(previous.imagePath);
    } catch (cause) {
      if (uploadedPath && !saved) await removeAnnouncementImage(uploadedPath);
      toast.error(cause instanceof Error ? cause.message : "Could not save the announcement. Your draft is still here.");
    } finally { lock.current = false; setBusy(false); }
  };
  const toggleArchive = async (post: PublicPost) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      await setPublicPostArchived(post.id, !post.archived);
      setPosts(current => current.map(item => item.id === post.id ? { ...item, archived: !post.archived } : item));
      if (post.id === editingId) reset();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not update the announcement."); }
    finally { lock.current = false; setBusy(false); }
  };
  const previewUrl = preview || getAnnouncementImageUrl(draft.imagePath);
  const visiblePosts = posts.filter(post => post.archived === showArchived);

  return <section className="space-y-5 border border-[#c4c0b9] bg-white p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold text-[#122d1f]">Landing page news</h1><p className="mt-1 text-sm text-[#53645b]">Publish announcements with an optional photo. Residents see them on the public page and in the portal.</p></div>
      <button type="button" disabled={busy} onClick={() => setShowArchived(value => !value)} className="min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold">{showArchived ? "View published" : "View archived"}</button>
    </header>
    {loadError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}
    <form onSubmit={submitPost} className="grid min-w-0 gap-4 rounded border border-[#d7ddd7] bg-[#f7faf7] p-4 md:grid-cols-2">
      <h2 className="font-bold md:col-span-2">{editingId ? "Edit announcement" : "Add an announcement"}</h2>
      <label className="grid gap-1.5 text-sm font-semibold">Title<input required maxLength={120} disabled={busy} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className={inputClass} /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Type<select disabled={busy} value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as PostType })} className={inputClass}><option value="NOTICE">Notice</option><option value="ADVISORY">Advisory</option><option value="UPDATE">Update</option></select></label>
      <label className="grid gap-1.5 text-sm font-semibold md:col-span-2">Announcement details<textarea required rows={4} maxLength={1000} disabled={busy} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} className={inputClass} /></label>
      <div className="min-w-0 space-y-3 md:col-span-2">
        <label className="grid gap-1.5 text-sm font-semibold">Announcement photo (optional)
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || validating} className={`${inputClass} max-w-full text-sm`} onChange={async event => {
            const selected = event.currentTarget.files?.[0]; if (!selected) return;
            setValidating(true);
            try { await validateAnnouncementImage(selected); setFile(selected); }
            catch (cause) { if (fileInput.current) fileInput.current.value = ""; toast.error(cause instanceof Error ? cause.message : "Could not open this image."); }
            finally { setValidating(false); }
          }} />
        </label>
        <p className="text-sm text-[#53645b]">JPG, PNG, or WebP, up to 5 MB. Include important dates and instructions in the announcement text too.</p>
        {previewUrl && <>
          <img src={previewUrl} alt={draft.imageAlt || "Announcement photo preview"} className="max-h-80 w-full rounded border border-[#d7ddd7] bg-white object-contain" />
          <label className="grid gap-1.5 text-sm font-semibold">Photo description<input maxLength={240} disabled={busy} value={draft.imageAlt} onChange={event => setDraft({ ...draft, imageAlt: event.target.value })} className={inputClass} placeholder="Describe the image for residents using a screen reader." /></label>
          <button type="button" disabled={busy} className="min-h-11 rounded border border-red-200 px-3 text-sm font-semibold text-red-800" onClick={() => { setFile(null); setDraft({ ...draft, imagePath: null, imageAlt: "" }); if (fileInput.current) fileInput.current.value = ""; }}>Remove photo</button>
        </>}
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button disabled={busy || validating || !draft.title.trim() || !draft.content.trim()} className="flex min-h-11 items-center gap-2 rounded bg-[#123323] px-5 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? "Saving…" : editingId ? "Save changes" : "Publish announcement"}</button>
        <button type="button" disabled={busy || validating} onClick={reset} className="min-h-11 rounded border border-[#c9d1ca] px-5 text-sm font-semibold">{editingId ? "Cancel editing" : "Clear draft"}</button>
      </div>
    </form>
    <div className="divide-y divide-[#e3e8e3] rounded border border-[#d7ddd7]">
      {visiblePosts.length ? visiblePosts.map(post => <article key={post.id} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#53645b]"><strong>{post.type}</strong><time dateTime={post.publishedAt}>{format(new Date(post.publishedAt), "MMM d, yyyy")}</time></div>
        <h2 className="break-words text-lg font-bold text-[#122d1f]">{post.title}</h2>
        <p className="whitespace-pre-line break-words text-base text-[#53645b]">{post.content}</p>
        <AnnouncementImage post={post} />
        <div className="flex flex-wrap gap-2">
          {!showArchived && <button type="button" disabled={busy || validating} onClick={() => { setEditingId(post.id); setDraft({ title: post.title, content: post.content, type: post.type, imagePath: post.imagePath ?? null, imageAlt: post.imageAlt ?? "" }); setFile(null); if (fileInput.current) fileInput.current.value = ""; }} className="flex min-h-11 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-semibold"><Pencil className="h-4 w-4" />Edit</button>}
          <button type="button" disabled={busy} onClick={() => void toggleArchive(post)} className="flex min-h-11 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-semibold">{showArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{showArchived ? "Restore" : "Archive"}</button>
        </div>
      </article>) : <p className="p-5 text-sm text-[#53645b]">{showArchived ? "No archived announcements." : "No published announcements yet."}</p>}
    </div>
  </section>;
}
