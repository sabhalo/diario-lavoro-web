export function isPlayableBlob(blob, kind, timeoutMs = 5_000) {
  return new Promise((resolve) => {
    if (!blob?.size) return resolve(false);
    const media = document.createElement(kind === "display" ? "video" : "audio"), url = URL.createObjectURL(blob); let done = false;
    const finish = (value) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(value); };
    media.preload = "auto";
    media.oncanplay = () => finish(true);
    media.onerror = () => finish(false);
    media.src = url;
    window.setTimeout(() => finish(false), timeoutMs);
  });
}

export function stopPlayback(media, url, revokeObjectURL = URL.revokeObjectURL) {
  media?.pause();
  media?.removeAttribute("src");
  media?.load();
  if (url) revokeObjectURL(url);
}
