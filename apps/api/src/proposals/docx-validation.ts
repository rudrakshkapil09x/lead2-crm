import { inflateRawSync } from "node:zlib";
// Validate and boundedly inflate every ZIP member before passing the document
// to Mammoth. No files are extracted to disk and ZIP paths are never followed.
export function validateDocxArchive(buffer: Buffer) {
  const fail = () => {
    throw new Error("Invalid or oversized DOCX archive");
  };
  if (buffer.length < 22 || buffer.length > 2 * 1024 * 1024) fail();
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) return fail();
  const count = buffer.readUInt16LE(end + 10),
    directorySize = buffer.readUInt32LE(end + 12),
    directoryOffset = buffer.readUInt32LE(end + 16);
  if (
    buffer.readUInt16LE(end + 4) ||
    buffer.readUInt16LE(end + 6) ||
    buffer.readUInt16LE(end + 8) !== count ||
    !count ||
    count > 300 ||
    directoryOffset + directorySize !== end
  )
    fail();
  let offset = directoryOffset,
    total = 0,
    hasDocument = false;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) fail();
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10),
      compressed = buffer.readUInt32LE(offset + 20),
      size = buffer.readUInt32LE(offset + 24),
      nameLength = buffer.readUInt16LE(offset + 28),
      extraLength = buffer.readUInt16LE(offset + 30),
      commentLength = buffer.readUInt16LE(offset + 32),
      local = buffer.readUInt32LE(offset + 42);
    total += size;
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      total > 10 * 1024 * 1024 ||
      offset + 46 + nameLength + extraLength + commentLength > end ||
      local + 30 > directoryOffset
    )
      fail();
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    if (
      names.has(name) ||
      name.includes("..") ||
      name.startsWith("/") ||
      name.includes("\\")
    )
      fail();
    names.add(name);
    if (name === "word/document.xml") hasDocument = true;
    if (
      buffer.readUInt32LE(local) !== 0x04034b50 ||
      buffer.readUInt16LE(local + 8) !== method
    )
      fail();
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + compressed > directoryOffset) fail();
    const bytes = buffer.subarray(start, start + compressed);
    const inflated =
      method === 0
        ? bytes
        : inflateRawSync(bytes, { maxOutputLength: Math.max(1, size) });
    if (inflated.length !== size) fail();
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end || !hasDocument) fail();
}
