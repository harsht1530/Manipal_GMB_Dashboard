/**
 * The ticket and request endpoints declare `attachments` with a maxCount of 10 (see the multer
 * middlewares in backend/server.js). Multer rejects the WHOLE request with
 * "MulterError: Unexpected field" on the eleventh file, so the pickers trim the selection
 * before it ever reaches the network rather than losing the user's description and files.
 */
export const MAX_ATTACHMENTS = 10;

/** Keeps the first MAX_ATTACHMENTS files and reports how many were left out. */
export const capAttachments = (files: FileList | File[] | null | undefined) => {
  const picked = files ? Array.from(files) : [];
  return {
    files: picked.slice(0, MAX_ATTACHMENTS),
    dropped: Math.max(0, picked.length - MAX_ATTACHMENTS),
  };
};

/** Toast body for a trimmed selection; null when nothing was dropped. */
export const attachmentLimitMessage = (dropped: number) =>
  dropped > 0
    ? `Only the first ${MAX_ATTACHMENTS} files were kept - ${dropped} more ${
        dropped === 1 ? "was" : "were"
      } left out. Attach at most ${MAX_ATTACHMENTS} files per upload.`
    : null;
