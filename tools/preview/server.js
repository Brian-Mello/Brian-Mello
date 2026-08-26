/**
 * Local preview server for the GitHub profile README.
 *
 * There is no traditional "app" in a profile repository: the deliverable is the
 * rendered README.md that GitHub shows on the profile page. This server renders
 * that same Markdown locally (GitHub-Flavored Markdown + github-markdown-css) so
 * the file can be edited and previewed without pushing to GitHub.
 *
 * The README is re-read on every request, so a browser refresh reflects edits.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Marked } = require("marked");
const { gfmHeadingId } = require("marked-gfm-heading-id");

const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || "0.0.0.0";
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const README_PATH = path.join(REPO_ROOT, "README.md");
const GITHUB_MD_CSS = require.resolve("github-markdown-css/github-markdown.css");

const marked = new Marked({ gfm: true, breaks: false });
marked.use(gfmHeadingId());

function renderPage() {
  const raw = fs.readFileSync(README_PATH, "utf8");
  const body = marked.parse(raw);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>README preview</title>
<link rel="stylesheet" href="/github-markdown.css" />
<style>
  body { margin: 0; background: #0d1117; }
  .markdown-body {
    box-sizing: border-box;
    min-width: 200px;
    max-width: 980px;
    margin: 0 auto;
    padding: 45px;
  }
</style>
</head>
<body>
  <article class="markdown-body" data-color-mode="dark" data-dark-theme="dark">
${body}
  </article>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  try {
    if (req.url === "/github-markdown.css") {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end(fs.readFileSync(GITHUB_MD_CSS, "utf8"));
      return;
    }
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderPage());
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Failed to render README: ${err.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`README preview running at http://localhost:${PORT}`);
  console.log(`Rendering: ${README_PATH}`);
});
