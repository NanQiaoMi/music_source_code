/* eslint-disable @typescript-eslint/no-explicit-any */
import { weapi, cookieToJson, cookieObjToString } from "./crypto";

export interface NeteaseRequestOptions {
  cookie?: string | Record<string, string>;
  headers?: Record<string, string>;
  realIP?: string;
}

export interface NeteaseResponse<T = any> {
  status: number;
  body: T;
  cookie: string[];
  cookieStr: string;
}

export async function neteaseWeApiRequest<T = any>(
  uri: string,
  data: Record<string, unknown> = {},
  options: NeteaseRequestOptions = {}
): Promise<NeteaseResponse<T>> {
  let cookieObj: Record<string, string> = {
    os: "pc",
    appver: "3.1.17.204416",
    osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
    channel: "netease",
  };

  if (typeof options.cookie === "string") {
    cookieObj = { ...cookieObj, ...cookieToJson(options.cookie) };
  } else if (typeof options.cookie === "object" && options.cookie !== null) {
    cookieObj = { ...cookieObj, ...options.cookie };
  }

  const csrfToken = cookieObj["__csrf"] || "";
  const encrypted = weapi({ ...data, csrf_token: csrfToken });
  const body = new URLSearchParams(encrypted).toString();

  let requestPath = uri;
  if (requestPath.startsWith("/api/")) {
    requestPath = "/weapi/" + requestPath.slice(5);
  } else if (!requestPath.startsWith("/weapi/")) {
    requestPath = "/weapi" + (requestPath.startsWith("/") ? "" : "/") + requestPath;
  }

  const url = `https://music.163.com${requestPath}`;

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    Referer: "https://music.163.com",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookieObjToString(cookieObj),
    ...(options.headers || {}),
  };

  if (options.realIP) {
    headers["X-Real-IP"] = options.realIP;
    headers["X-Forwarded-For"] = options.realIP;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    const setCookies: string[] = [];
    const setCookieHeader = res.headers.get("set-cookie");
    if (setCookieHeader) {
      setCookies.push(setCookieHeader);
    }
    if (typeof (res.headers as any).getSetCookie === "function") {
      const allCookies = (res.headers as any).getSetCookie();
      if (Array.isArray(allCookies)) {
        setCookies.splice(0, setCookies.length, ...allCookies);
      }
    }

    const cookieMap: Record<string, string> = {};
    setCookies.forEach((c) => {
      const parts = c.split(";")[0].split("=");
      if (parts.length >= 2) {
        cookieMap[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    });

    const cookieStr = Object.entries(cookieMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const resJson = await res.json().catch(() => ({}));

    return {
      status: res.status,
      body: resJson as T,
      cookie: setCookies,
      cookieStr,
    };
  } catch (error) {
    console.error("[neteaseWeApiRequest] error:", error);
    return {
      status: 500,
      body: { code: 500, message: "NetEase request failed" } as T,
      cookie: [],
      cookieStr: "",
    };
  }
}
