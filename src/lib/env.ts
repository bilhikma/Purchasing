/** true saat dibangun sebagai halaman claude.ai (npm run build:artifact). */
export const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === "1";

type Downloads = { save(r: { filename: string; data: Blob }): Promise<unknown> };
type ClaudeRuntime = { use(name: string): Promise<unknown> };

/** Simpan file: lewat izin "downloads" di claude.ai, atau download biasa di browser. */
export async function saveFile(filename: string, blob: Blob): Promise<"saved" | "declined" | "unavailable"> {
  const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (rt) {
    let dl: Downloads | null = null;
    try { dl = (await rt.use("downloads")) as Downloads | null; } catch { dl = null; }
    if (!dl) return "unavailable";
    try { await dl.save({ filename, data: blob }); return "saved"; }
    catch (e) { return (e as { code?: string })?.code === "declined" ? "declined" : "unavailable"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "saved";
}
