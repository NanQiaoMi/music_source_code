const path = require("path");

function resolveStaticPath(requestUrl, outDirectory) {
  const url = new URL(requestUrl);
  if (url.protocol !== "app:" || url.hostname !== "app") {
    return null;
  }

  const rawPathname = requestUrl.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] || "/";

  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  const routeMap = {
    "/": "index.html",
    "/data-manager": "data-manager.html",
    "/data-manager/": "data-manager.html",
  };
  const relativePath = routeMap[pathname] || pathname.replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("..")) return null;

  const root = path.resolve(outDirectory);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

module.exports = { resolveStaticPath };
