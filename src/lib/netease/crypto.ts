import crypto from "crypto";

const iv = Buffer.from("0102030405060708", "utf8");
const presetKey = Buffer.from("0CoJUm6Qyw8W8jud", "utf8");
const base62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;

function aesEncrypt(buffer: Buffer, key: Buffer, ivBuf: Buffer): string {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, ivBuf);
  return Buffer.concat([cipher.update(buffer), cipher.final()]).toString("base64");
}

function rsaEncrypt(buffer: Buffer, keyPem: string): string {
  const padded = Buffer.alloc(128);
  buffer.copy(padded, 128 - buffer.length);
  return crypto
    .publicEncrypt(
      {
        key: keyPem,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      padded
    )
    .toString("hex");
}

export function weapi(object: Record<string, unknown>): { params: string; encSecKey: string } {
  const text = JSON.stringify(object);
  let secretKey = "";
  for (let i = 0; i < 16; i++) {
    secretKey += base62.charAt(Math.floor(Math.random() * 62));
  }

  const step1 = aesEncrypt(Buffer.from(text, "utf8"), presetKey, iv);
  const params = aesEncrypt(Buffer.from(step1, "utf8"), Buffer.from(secretKey, "utf8"), iv);
  const encSecKey = rsaEncrypt(Buffer.from(secretKey.split("").reverse().join(""), "utf8"), publicKey);

  return { params, encSecKey };
}

export function cookieToJson(cookieStr: string): Record<string, string> {
  const cookie: Record<string, string> = {};
  if (!cookieStr || typeof cookieStr !== "string") return cookie;

  cookieStr.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (key) {
        cookie[key] = val;
      }
    }
  });

  return cookie;
}

export function cookieObjToString(cookieObj: Record<string, string>): string {
  return Object.entries(cookieObj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("; ");
}
