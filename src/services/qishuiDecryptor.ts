import crypto from "crypto";

function bitCount(value: number): number {
  let current = value;
  current = current - ((current >> 1) & 0x55555555);
  current = (current & 0x33333333) + ((current >> 2) & 0x33333333);
  return (((current + (current >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

function decodeBase36(charCode: number): number {
  if (charCode >= 48 && charCode <= 57) {
    return charCode - 48;
  }
  if (charCode >= 97 && charCode <= 122) {
    return charCode - 97 + 10;
  }
  return 0xff;
}

function decryptSpadeInner(spadeKey: Buffer): Buffer {
  const result = Buffer.from(spadeKey);
  const working = Buffer.alloc(spadeKey.length + 2);
  working[0] = 0xfa;
  working[1] = 0x55;
  spadeKey.copy(working, 2);

  for (let index = 0; index < result.length; index += 1) {
    let value = (spadeKey[index] ^ working[index]) - bitCount(index) - 21;
    while (value < 0) {
      value += 0xff;
    }
    result[index] = value & 0xff;
  }
  return result;
}

export function decryptSpade(spadeKeyBytes: Buffer): string {
  if (!Buffer.isBuffer(spadeKeyBytes) || spadeKeyBytes.length < 3) {
    return "";
  }
  const paddingLength = (spadeKeyBytes[0] ^ spadeKeyBytes[1] ^ spadeKeyBytes[2]) - 48;
  if (spadeKeyBytes.length < paddingLength + 2) {
    return "";
  }

  const innerInput = spadeKeyBytes.subarray(1, spadeKeyBytes.length - paddingLength);
  const tempBuffer = decryptSpadeInner(innerInput);
  if (tempBuffer.length === 0) {
    return "";
  }

  const skipBytes = decodeBase36(tempBuffer[0]);
  const decodedMessageLength = spadeKeyBytes.length - paddingLength - 2;
  const rawKey = tempBuffer.subarray(skipBytes + 1, decodedMessageLength + 1);
  return rawKey.toString("utf8");
}

export function decryptAudioBuffer(encryptedBuffer: Buffer, keyHex: string): Buffer {
  try {
    const key = Buffer.from(keyHex, "hex");
    const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  } catch (error) {
    console.error("[QishuiDecryptor] Decryption failed:", error);
    return encryptedBuffer;
  }
}
