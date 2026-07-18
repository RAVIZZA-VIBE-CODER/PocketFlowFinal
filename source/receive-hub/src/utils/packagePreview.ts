export interface PackageTextSection {
  name: string;
  text: string;
}

export interface PackagePreview {
  entries: string[];
  sections: PackageTextSection[];
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const textDecoder = new TextDecoder("utf-8");

const readUInt16 = (view: DataView, offset: number) => view.getUint16(offset, true);
const readUInt32 = (view: DataView, offset: number) => view.getUint32(offset, true);

const findEndOfCentralDirectory = (bytes: Uint8Array) => {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
};

const parseZipEntries = (bytes: Uint8Array): ZipEntry[] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) return [];

  const entryCount = readUInt16(view, eocdOffset + 10);
  const centralDirectoryOffset = readUInt32(view, eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(view, offset) !== 0x02014b50) break;
    const compression = readUInt16(view, offset + 10);
    const compressedSize = readUInt32(view, offset + 20);
    const fileNameLength = readUInt16(view, offset + 28);
    const extraLength = readUInt16(view, offset + 30);
    const commentLength = readUInt16(view, offset + 32);
    const localHeaderOffset = readUInt32(view, offset + 42);
    const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    entries.push({ name, compression, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
};

const inflateRaw = async (data: Uint8Array) => {
  if (!("DecompressionStream" in window)) return null;
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readZipEntry = async (bytes: Uint8Array, entry: ZipEntry) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (readUInt32(view, offset) !== 0x04034b50) return null;

  const fileNameLength = readUInt16(view, offset + 26);
  const extraLength = readUInt16(view, offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressedData = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compression === 0) return compressedData;
  if (entry.compression === 8) return inflateRaw(compressedData);
  return null;
};

const decodeXmlText = (xml: string) =>
  xml
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

const getPackageTargets = (extension: string, entries: ZipEntry[]) => {
  if (extension === "pptx") {
    return entries
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  if (extension === "docx") {
    return entries.filter((entry) => entry.name === "word/document.xml");
  }
  if (["epub", "pages"].includes(extension)) {
    return entries
      .filter((entry) => /\.(xhtml|html|xml)$/i.test(entry.name) && !entry.name.includes("/_rels/"))
      .slice(0, 16);
  }
  return [];
};

export async function extractPackagePreview(blob: Blob, extension: string): Promise<PackagePreview | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) return null;

  const normalizedExtension = extension.toLowerCase();
  const targets = getPackageTargets(normalizedExtension, entries);
  const sections: PackageTextSection[] = [];

  for (const target of targets.slice(0, normalizedExtension === "pptx" ? 80 : 20)) {
    const data = await readZipEntry(bytes, target);
    if (!data) continue;
    const text = decodeXmlText(textDecoder.decode(data));
    if (text) {
      sections.push({
        name: target.name.replace(/^ppt\/slides\//, "Slide ").replace(/^word\//, ""),
        text
      });
    }
  }

  return {
    entries: entries.map((entry) => entry.name).slice(0, 120),
    sections
  };
}
