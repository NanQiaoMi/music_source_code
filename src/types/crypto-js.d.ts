/**
 * crypto-js 的最小类型声明。
 * 该包不自带类型且项目未安装 @types/crypto-js，原先整个模块被声明成 any，
 * 等于 lxRunner 里的全部加密调用都绕开了类型检查。
 * 这里只声明实际用到的成员（lxRunner.ts），保持调用方代码不变。
 */
declare module "crypto-js" {
  interface WordArray {
    toString(enc?: unknown): string;
  }

  interface EncryptResult {
    toString(): string;
  }

  interface Encoder {
    parse(input: string): WordArray;
    stringify(input: WordArray): string;
  }

  interface CryptoJSApi {
    enc: {
      Hex: Encoder;
      Base64: Encoder;
      Utf8: Encoder;
    };
    MD5(message: string): WordArray;
    SHA256(message: string): WordArray;
    AES: {
      encrypt(
        message: string,
        key: WordArray,
        cfg?: { iv?: WordArray; mode?: unknown; padding?: unknown }
      ): EncryptResult;
    };
    mode: { CBC: unknown };
    pad: { Pkcs7: unknown };
  }

  const CryptoJS: CryptoJSApi;
  export default CryptoJS;
}
