const { app, net } = require("electron");
const path = require("path");
const fs = require("fs");
const vm = require("vm");
const axios = require("axios");
const CryptoJS = require("crypto-js");

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginsPath = path.join(app.getPath("userData"), "plugins");
    if (!fs.existsSync(this.pluginsPath)) {
      fs.mkdirSync(this.pluginsPath, { recursive: true });
    }
  }

  async loadPlugins() {
    try {
      const files = fs.readdirSync(this.pluginsPath);
      for (const file of files) {
        if (file.endsWith(".js")) {
          await this.loadPlugin(path.join(this.pluginsPath, file));
        }
      }
      console.log(`Loaded ${this.plugins.size} plugins.`);
    } catch (error) {
      console.error("Error loading plugins:", error);
    }
  }

  async loadPlugin(filePath) {
    try {
      const code = fs.readFileSync(filePath, "utf-8");
      const pluginId = path.basename(filePath, ".js");

      const sandbox = this.createSandbox();
      const script = new vm.Script(code);
      script.runInContext(sandbox);

      const exports = sandbox.module.exports;
      if (exports && exports.platform) {
        this.plugins.set(pluginId, {
          ...exports,
          id: pluginId,
          instance: exports,
        });
        console.log(`Plugin loaded: ${exports.platform} (${pluginId})`);
      }
    } catch (error) {
      console.error(`Failed to load plugin from ${filePath}:`, error);
    }
  }

  createSandbox() {
    const sandbox = {
      module: { exports: {} },
      exports: {},
      console: console,
      BigInt: BigInt,
      Buffer: Buffer,
      CryptoJS: CryptoJS,
      // MusicFree standard fetch/request polyfill
      fetch: async (url, options = {}) => {
        try {
          const response = await axios({
            url,
            method: options.method || "GET",
            data: options.body,
            headers: options.headers,
            responseType: options.responseType || "json",
          });
          return {
            json: async () => response.data,
            text: async () =>
              typeof response.data === "string" ? response.data : JSON.stringify(response.data),
            status: response.status,
            ok: response.status >= 200 && response.status < 300,
          };
        } catch (error) {
          console.error("Fetch error in plugin:", error);
          throw error;
        }
      },
      // Some plugins might use a global 'env' or 'request'
      request: async (config) => {
        const response = await axios(config);
        return response.data;
      },
    };
    return vm.createContext(sandbox);
  }

  async search(query, page = 1, type = "music") {
    const results = [];
    for (const [id, plugin] of this.plugins) {
      if (plugin.search) {
        try {
          const pluginResults = await plugin.search(query, page, type);
          if (Array.isArray(pluginResults)) {
            results.push(
              ...pluginResults.map((item) => ({
                ...item,
                _pluginId: id,
                _platform: plugin.platform,
              }))
            );
          } else if (pluginResults && pluginResults.data) {
            results.push(
              ...pluginResults.data.map((item) => ({
                ...item,
                _pluginId: id,
                _platform: plugin.platform,
              }))
            );
          }
        } catch (error) {
          console.error(`Search error in plugin ${id}:`, error);
        }
      }
    }
    return results;
  }

  async getMediaSource(musicItem, quality = "standard") {
    const plugin = this.plugins.get(musicItem._pluginId);
    if (plugin && plugin.getMediaSource) {
      try {
        return await plugin.getMediaSource(musicItem, quality);
      } catch (error) {
        console.error(`GetMediaSource error in plugin ${musicItem._pluginId}:`, error);
      }
    }
    return null;
  }

  async getLyric(musicItem) {
    const plugin = this.plugins.get(musicItem._pluginId);
    if (plugin && plugin.getLyric) {
      try {
        return await plugin.getLyric(musicItem);
      } catch (error) {
        console.error(`GetLyric error in plugin ${musicItem._pluginId}:`, error);
      }
    }
    return null;
  }

  listPlugins() {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.id,
      platform: p.platform,
      version: p.version,
      author: p.author,
    }));
  }
}

module.exports = new PluginManager();
