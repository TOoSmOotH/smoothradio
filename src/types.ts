export interface TrackMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string[];
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  codec: string | null;
  lossless: boolean;
}

export interface ScannedTrack {
  filePath: string;
  fileName: string;
  fileSize: number;
  lastModified: Date;
  metadata: TrackMetadata;
}

export interface ScanResult {
  tracks: ScannedTrack[];
  errors: ScanError[];
  scannedAt: Date;
  totalFiles: number;
  totalDuration: number;
}

export interface ScanError {
  filePath: string;
  error: string;
}

export interface ScanOptions {
  recursive?: boolean;
  extensions?: string[];
  onProgress?: (scanned: number, total: number) => void;
  concurrency?: number;
}
