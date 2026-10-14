import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before uploading templates.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "BRGY. CERTS AND ETC");
const templateFiles = (await readdir(sourceDirectory)).filter((name) => name.toLowerCase().endsWith(".docx"));

if (!templateFiles.length) {
  throw new Error(`No DOCX templates were found in ${sourceDirectory}.`);
}

for (const fileName of templateFiles) {
  const file = await readFile(join(sourceDirectory, fileName));
  const { error } = await supabase.storage
    .from("certificate-templates")
    .upload(fileName, file, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (error) throw new Error(`Could not upload ${fileName}: ${error.message}`);
  console.log(`Uploaded ${fileName}`);
}

console.log(`Uploaded ${templateFiles.length} certificate templates to private storage.`);
