import { deflateRawSync } from "node:zlib";
import { validateDocxArchive } from "../src/proposals/docx-validation";
function zip(data: Buffer, declaredSize = data.length) {
  const filename = Buffer.from("word/document.xml"),
    compressed = deflateRawSync(data),
    local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + compressed.length, 16);
  return Buffer.concat([local, filename, compressed, central, filename, end]);
}
describe("Bounded DOCX archive inspection", () => {
  it("accepts a small standard ZIP member", () => {
    expect(() =>
      validateDocxArchive(zip(Buffer.from("<document/>"))),
    ).not.toThrow();
  });
  it("rejects allocation and decompression bombs before document conversion", () => {
    expect(() =>
      validateDocxArchive(zip(Buffer.from("x"), 0xffffffff)),
    ).toThrow();
    expect(() =>
      validateDocxArchive(zip(Buffer.alloc(100000, 65), 10)),
    ).toThrow();
    expect(() => validateDocxArchive(Buffer.from("not a ZIP"))).toThrow();
  });
});
