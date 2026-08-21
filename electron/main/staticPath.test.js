const path = require("path");
const { resolveStaticPath } = require("./staticPath");

const outputDirectory = path.join(process.cwd(), "test-static-root");

describe("resolveStaticPath", () => {
  it("maps application routes to exported HTML files", () => {
    expect(resolveStaticPath("app://app/", outputDirectory)).toBe(path.join(outputDirectory, "index.html"));
    expect(resolveStaticPath("app://app/data-manager", outputDirectory)).toBe(
      path.join(outputDirectory, "data-manager.html")
    );
    expect(resolveStaticPath("app://app/data-manager/", outputDirectory)).toBe(
      path.join(outputDirectory, "data-manager.html")
    );
  });

  it("resolves static assets and ignores query strings", () => {
    expect(resolveStaticPath("app://app/_next/static/app.js", outputDirectory)).toBe(
      path.join(outputDirectory, "_next", "static", "app.js")
    );
    expect(resolveStaticPath("app://app/?desktop-lyrics=true", outputDirectory)).toBe(
      path.join(outputDirectory, "index.html")
    );
  });

  it("rejects wrong origins and unsafe paths", () => {
    expect(resolveStaticPath("https://app/", outputDirectory)).toBeNull();
    expect(resolveStaticPath("app://other/", outputDirectory)).toBeNull();
    expect(resolveStaticPath("app://app/../secret", outputDirectory)).toBeNull();
    expect(resolveStaticPath("app://app/%2e%2e/secret", outputDirectory)).toBeNull();
    expect(resolveStaticPath("app://app/%E0%A4%A", outputDirectory)).toBeNull();
  });
});
