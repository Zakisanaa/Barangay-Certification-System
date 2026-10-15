import { requireSupabase } from "./supabase";

export async function validateAnnouncementImage(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const format = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg"
    : bytes.slice(0, 8).join() === "137,80,78,71,13,10,26,10" ? "png"
    : String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP" ? "webp" : null;
  const mime = format === "jpg" ? "image/jpeg" : `image/${format}`;
  if (!format || file.type !== mime) throw new Error("Choose a valid JPG, PNG, or WebP image.");
  const decoded = await createImageBitmap(file).catch(() => { throw new Error("This image could not be opened. Choose another picture."); });
  const pixels = decoded.width * decoded.height;
  decoded.close();
  if (pixels > 40000000) throw new Error("Choose an image smaller than 40 megapixels.");
  return { format, mime };
}

export function getAnnouncementImageUrl(path?: string | null) {
  if (!path) return "";
  return requireSupabase().storage.from("announcement-images").getPublicUrl(path).data.publicUrl;
}

export async function uploadAnnouncementImage(postId: string, file: File) {
  const { format, mime } = await validateAnnouncementImage(file);
  const path = `${postId}/${crypto.randomUUID()}.${format}`;
  const { error } = await requireSupabase().storage.from("announcement-images").upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(`Could not upload the picture: ${error.message}`);
  return path;
}

export async function removeAnnouncementImage(path: string) {
  const { error } = await requireSupabase().storage.from("announcement-images").remove([path]);
  if (error) console.error("Could not remove an unused announcement image.", error.message);
}
