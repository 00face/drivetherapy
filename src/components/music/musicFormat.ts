export const formatTime = (secs: number): string => {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const sec = Math.floor(secs % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};
