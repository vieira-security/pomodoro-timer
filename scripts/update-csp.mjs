// Recalcula o hash SHA-256 do script inline do index.html e atualiza a CSP.
// Rode sempre que alterar o <script> inline: npm run csp
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const file = new URL("../public/index.html", import.meta.url);
let html = await readFile(file, "utf8");
const inline = html.match(/<script>([\s\S]*?)<\/script>/);
if (!inline) throw new Error("Nenhum <script> inline encontrado");
const hash = createHash("sha256").update(inline[1]).digest("base64");
const updated = html.replace(/'sha256-[A-Za-z0-9+/=]+'/, `'sha256-${hash}'`);
if (updated === html) console.log("CSP já está atualizada:", hash);
else { await writeFile(file, updated); console.log("CSP atualizada:", hash); }
