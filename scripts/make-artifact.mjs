// Menyusun halaman claude.ai dari hasil `vite build` mode artefak:
// CSS ditanam di halaman, JavaScript dipublish sebagai file app.js di sebelahnya.
import { readFileSync, writeFileSync } from "node:fs";

const css = readFileSync("dist-artifact/app.css", "utf8");
const page = `<title>Bilhikma Purchasing</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module" src="app.js"></script>
`;
writeFileSync("dist-artifact/bilhikma-purchasing.html", page);
console.log("dist-artifact/bilhikma-purchasing.html siap (" + Math.round(page.length / 1024) + " KB) + app.js");
