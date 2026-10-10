export type StatusBucket = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export function statusBucket(name: string): StatusBucket {
  const value = name.trim().toLocaleLowerCase('vi');
  if (value.includes('hoàn') || value === 'done' || value.includes('xong')) return 'DONE';
  if (value.includes('review') || value.includes('đánh giá')) return 'REVIEW';
  if (value.includes('đang') || value.includes('thực hiện')) return 'IN_PROGRESS';
  return 'TODO';
}

export function statusColor(name: string) {
  const bucket = statusBucket(name);
  if (bucket === 'DONE') return '#22a06b';
  if (bucket === 'REVIEW') return '#6e5dc6';
  if (bucket === 'IN_PROGRESS') return '#0c66e4';
  return '#8590a2';
}
