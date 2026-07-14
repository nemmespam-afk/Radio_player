/**
 * Minimal ID3v2.3/v2.4 tag reader for browser (no dependencies).
 * Reads: TIT2 (title), TPE1 (artist), TALB (album), APIC (cover art).
 */

export interface ID3Tags {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string; // object URL — caller must revoke when done
}

function syncsafeToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) return new TextDecoder("iso-8859-1").decode(bytes);
    if (encoding === 3) return new TextDecoder("utf-8").decode(bytes);
    if (encoding === 1 || encoding === 2) return new TextDecoder("utf-16").decode(bytes);
  } catch {
    // fall through
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function readID3Tags(file: File): Promise<ID3Tags> {
  // Read first 256 KB — enough for tags + embedded art in most files
  const slice = file.slice(0, 256 * 1024);
  const buf = await slice.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Check ID3v2 signature
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }

  const majorVersion = bytes[3]; // 3 or 4
  const flags = bytes[5];
  const hasExtHeader = (flags & 0x40) !== 0;

  // Tag size (syncsafe integer)
  const tagSize = syncsafeToInt(bytes, 6) + 10;

  let pos = 10;

  // Skip extended header (ID3v2.4)
  if (hasExtHeader && majorVersion === 4) {
    const extSize = syncsafeToInt(bytes, pos);
    pos += extSize;
  }

  const result: ID3Tags = {};
  let coverUrl: string | undefined;

  while (pos < tagSize && pos < bytes.length - 10) {
    const frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);

    if (frameId === "\0\0\0\0") break; // padding

    let frameSize: number;
    if (majorVersion === 4) {
      frameSize = syncsafeToInt(bytes, pos + 4);
    } else {
      // ID3v2.3: big-endian 32-bit
      const v = new DataView(bytes.buffer, bytes.byteOffset + pos + 4, 4);
      frameSize = v.getUint32(0);
    }

    pos += 10; // skip frame header

    if (frameSize <= 0 || pos + frameSize > bytes.length) break;

    const frameData = bytes.slice(pos, pos + frameSize);

    if (frameId === "TIT2" || frameId === "TPE1" || frameId === "TALB") {
      const encoding = frameData[0];
      const text = decodeText(frameData.slice(1), encoding).replace(/\0/g, "").trim();
      if (frameId === "TIT2") result.title = text;
      if (frameId === "TPE1") result.artist = text;
      if (frameId === "TALB") result.album = text;
    } else if (frameId === "APIC" && !coverUrl) {
      // APIC: encoding(1) + mime(null-terminated) + pictureType(1) + description(null-terminated) + data
      const encoding = frameData[0];
      let i = 1;
      // read mime type (iso-8859-1, null-terminated)
      while (i < frameData.length && frameData[i] !== 0) i++;
      const mimeEnd = i;
      const mime = String.fromCharCode(...frameData.slice(1, mimeEnd)) || "image/jpeg";
      i++; // skip null
      // skip picture type byte
      i++;
      // skip description (null-terminated, encoding-aware)
      const nullSize = encoding === 1 || encoding === 2 ? 2 : 1;
      while (i < frameData.length) {
        if (nullSize === 2) {
          if (frameData[i] === 0 && frameData[i + 1] === 0) { i += 2; break; }
          i += 2;
        } else {
          if (frameData[i] === 0) { i++; break; }
          i++;
        }
      }
      if (i < frameData.length) {
        const imgData = frameData.slice(i);
        const blob = new Blob([imgData], { type: mime });
        coverUrl = URL.createObjectURL(blob);
      }
    }

    pos += frameSize;
  }

  if (coverUrl) result.coverUrl = coverUrl;
  return result;
}
