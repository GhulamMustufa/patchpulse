import zlib from "node:zlib";
import { RepoFile } from "./schemas";
import {
  INGEST_LIMITS,
  isUnsafeArchivePath,
  classifyRepoFile,
} from "./repo-metadata";

export { INGEST_LIMITS, isUnsafeArchivePath, classifyRepoFile };

function stripCommonTopFolder(paths: string[]): string {
  if (paths.length === 0) return "";
  const firstSegments = paths.map((p) => p.split("/")[0]);
  const candidate = firstSegments[0];
  if (
    candidate &&
    paths.every((p) => p.includes("/") && p.split("/")[0] === candidate)
  ) {
    return `${candidate}/`;
  }
  return "";
}

export interface ParsedZipResult {
  files: RepoFile[];
  totalBytes: number;
  truncated: boolean;
  skippedCount: number;
  warnings: string[];
}

export function extractSafePythonZip(buffer: Buffer): ParsedZipResult {
  if (buffer.length > INGEST_LIMITS.maxArchiveBytes) {
    throw new Error(
      `Archive exceeds maximum allowed size (${INGEST_LIMITS.maxArchiveBytes / (1024 * 1024)} MB).`
    );
  }
  if (buffer.length < 22) {
    throw new Error("Invalid or empty ZIP archive.");
  }

  // Verify ZIP signature exists (PK\x03\x04 or empty archive PK\x05\x06)
  const hasZipMagic =
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x05 && buffer[3] === 0x06);
  if (!hasZipMagic) {
    throw new Error("Unsupported archive format: file is not a valid ZIP archive.");
  }

  // Locate End of Central Directory (EOCD: 0x06054b50)
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Malformed ZIP archive: missing End of Central Directory.");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset >= buffer.length) {
    throw new Error("Malformed ZIP archive: invalid central directory offset.");
  }

  interface RawEntry {
    fileName: string;
    compressionMethod: number;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
  }

  const rawEntries: RawEntry[] = [];
  let ptr = centralDirOffset;

  for (let idx = 0; idx < totalEntries; idx++) {
    if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error("Malformed ZIP archive: corrupt central directory entry.");
    }

    const compressionMethod = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const uncompressedSize = buffer.readUInt32LE(ptr + 24);
    const fileNameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const externalAttrs = buffer.readUInt32LE(ptr + 38);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);

    const fileName = buffer.toString("utf8", ptr + 46, ptr + 46 + fileNameLen);
    ptr += 46 + fileNameLen + extraLen + commentLen;

    // Reject symbolic links (POSIX S_IFLNK = 0o120000 in upper 16 bits)
    const unixMode = (externalAttrs >>> 16) & 0o170000;
    if (unixMode === 0o120000) {
      throw new Error(`Unsafe archive entry rejected (symbolic link): ${fileName}`);
    }

    if (fileName.endsWith("/")) {
      continue; // directory entry
    }

    if (isUnsafeArchivePath(fileName)) {
      throw new Error(`Unsafe archive file path rejected: ${fileName}`);
    }

    rawEntries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
  }

  if (rawEntries.length === 0) {
    throw new Error("ZIP archive contains no files.");
  }

  const commonPrefix = stripCommonTopFolder(rawEntries.map((e) => e.fileName));
  const files: RepoFile[] = [];
  const warnings: string[] = [];
  let totalBytes = 0;
  let truncated = false;
  let skippedCount = 0;

  for (const entry of rawEntries) {
    const cleanPath = commonPrefix
      ? entry.fileName.slice(commonPrefix.length)
      : entry.fileName;

    if (!cleanPath) continue;

    const classification = classifyRepoFile(cleanPath);
    if (!classification.include) {
      skippedCount++;
      continue;
    }

    if (files.length >= INGEST_LIMITS.maxFiles) {
      truncated = true;
      skippedCount++;
      continue;
    }

    if (entry.uncompressedSize > INGEST_LIMITS.maxFileBytes) {
      skippedCount++;
      warnings.push(
        `Skipped ${cleanPath}: file size (${entry.uncompressedSize} bytes) exceeds 100 KB limit.`
      );
      continue;
    }

    if (totalBytes + entry.uncompressedSize > INGEST_LIMITS.maxTotalExtractedBytes) {
      truncated = true;
      skippedCount++;
      continue;
    }

    if (
      entry.localHeaderOffset + 30 > buffer.length ||
      buffer.readUInt32LE(entry.localHeaderOffset) !== 0x04034b50
    ) {
      throw new Error(`Malformed local file header for ${cleanPath}`);
    }

    const localNameLen = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataStart = entry.localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + entry.compressedSize;

    if (dataEnd > buffer.length) {
      throw new Error(`Truncated compressed stream for ${cleanPath}`);
    }

    const compressedSlice = buffer.subarray(dataStart, dataEnd);
    let contentBuf: Buffer;

    if (entry.compressionMethod === 0) {
      contentBuf = compressedSlice;
    } else if (entry.compressionMethod === 8) {
      contentBuf = zlib.inflateRawSync(compressedSlice, {
        maxOutputLength: INGEST_LIMITS.maxFileBytes + 1,
      });
    } else {
      skippedCount++;
      warnings.push(
        `Skipped ${cleanPath}: unsupported ZIP compression method (${entry.compressionMethod}).`
      );
      continue;
    }

    if (contentBuf.length > INGEST_LIMITS.maxFileBytes) {
      skippedCount++;
      warnings.push(`Skipped ${cleanPath}: decompressed size exceeded 100 KB limit.`);
      continue;
    }

    // Skip binary files containing null bytes
    if (contentBuf.includes(0)) {
      skippedCount++;
      continue;
    }

    totalBytes += contentBuf.length;
    files.push({
      path: cleanPath,
      content: contentBuf.toString("utf8"),
      sizeBytes: contentBuf.length,
      language: classification.language,
      isTestFile: classification.isTestFile,
      isDependencyManifest: classification.isDependencyManifest,
    });
  }

  if (truncated) {
    warnings.push(
      `Repository truncated to ${INGEST_LIMITS.maxFiles} files / 1 MB text cap.`
    );
  }

  return {
    files,
    totalBytes,
    truncated,
    skippedCount,
    warnings,
  };
}
