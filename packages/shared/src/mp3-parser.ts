import { readFileSync } from 'fs';

const ID3_HEADER = 'ID3';
const ID3_VERSION_MAJOR = 3;
const ID3_VERSION_MINOR = 0;

export interface MP3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  track?: string;
  duration?: number;
}

export function parseID3Tags(buffer: Buffer): MP3Metadata {
  const metadata: MP3Metadata = {};

  if (buffer.length < 10) {
    return metadata;
  }

  const header = buffer.toString('utf8', 0, 3);
  if (header !== ID3_HEADER) {
    return metadata;
  }

  const version = buffer.readUInt8(3);
  if (version !== ID3_VERSION_MAJOR) {
    return metadata;
  }

  const flags = buffer.readUInt8(5);
  const tagsSize = syncSafeToInt(buffer, 6, 10);

  if (buffer.length < tagsSize + 10) {
    return metadata;
  }

  let offset = 10;
  while (offset < 10 + tagsSize) {
    const frameId = buffer.toString('utf8', offset, offset + 4);
    offset += 4;

    const frameSize = syncSafeToInt(buffer, offset, offset + 4);
    offset += 4;

    const frameFlags = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + frameSize > 10 + tagsSize) {
      break;
    }

    const frameData = buffer.subarray(offset, offset + frameSize);
    offset += frameSize;

    decodeFrame(frameId, frameData, metadata);
  }

  return metadata;
}

function syncSafeToInt(buffer: Buffer, start: number, end: number): number {
  let value = 0;
  for (let i = start; i < end; i++) {
    value = (value << 7) | (buffer.readUInt8(i) & 0x7f);
  }
  return value;
}

function decodeFrame(frameId: string, data: Buffer, metadata: MP3Metadata): void {
  switch (frameId) {
    case 'TIT2':
    case 'TIT1':
      metadata.title = decodeText(data);
      break;
    case 'TPE1':
    case 'TP1':
      metadata.artist = decodeText(data);
      break;
    case 'TALB':
    case 'TAL':
      metadata.album = decodeText(data);
      break;
    case 'TCON':
    case 'TCO':
      metadata.genre = decodeText(data);
      break;
    case 'TDRC':
    case 'TYER':
      metadata.year = decodeText(data);
      break;
    case 'TRCK':
    case 'TRK':
      metadata.track = decodeText(data);
      break;
  }
}

function decodeText(data: Buffer): string {
  if (data.length === 0) {
    return '';
  }

  const encoding = data.readUInt8(0);
  const textBuffer = data.subarray(1);

  switch (encoding) {
    case 0: // ISO-8859-1
      return textBuffer.toString('latin1');
    case 1: // UTF-16 with BOM
      if (textBuffer.length < 2) return '';
      const hasBom = textBuffer.readUInt16LE(0) === 0xfeff;
      return hasBom ? textBuffer.toString('utf16le', 2) : textBuffer.toString('utf16le');
    case 2: // UTF-16BE without BOM
      return Buffer.from(textBuffer).toString('utf16le');
    case 3: // UTF-8
      return textBuffer.toString('utf8');
    default:
      return textBuffer.toString('utf8');
  }
}
