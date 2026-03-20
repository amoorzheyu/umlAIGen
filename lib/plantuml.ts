import zlib from "zlib";

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const PUML_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

/**
 * Encodes PlantUML source text into the URL-safe token format.
 * Mirrors the Python implementation: UTF-8 → raw deflate → custom base64.
 */
export function encodePlantUML(text: string): string {
  const buf = Buffer.from(text, "utf-8");
  // deflateRaw = raw DEFLATE (no zlib 2-byte header or 4-byte checksum)
  const compressed = zlib.deflateRawSync(buf, { level: 9 });
  const b64 = compressed.toString("base64");

  return b64
    .split("")
    .map((c) => {
      const i = B64_CHARS.indexOf(c);
      return i >= 0 ? PUML_CHARS[i] : c;
    })
    .join("");
}

export function getPlantUMLPngUrl(umlCode: string): string {
  return `https://www.plantuml.com/plantuml/png/${encodePlantUML(umlCode)}`;
}

export function getPlantUMLSvgUrl(umlCode: string): string {
  return `https://www.plantuml.com/plantuml/svg/${encodePlantUML(umlCode)}`;
}
