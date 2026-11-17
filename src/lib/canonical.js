// One address per page. The same build is also reachable on old hosts
// (noteful-519.pages.dev, notewith-me.netlify.app); this points search engines to noteful.me.
const ORIGIN = "https://noteful.me";

export function setCanonical(path) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = ORIGIN + path;
}
