import { describe, expect, it } from 'vitest';
import { statusBucket, statusColor } from './status-bucket.js';

describe('statusBucket', () => {
  it('maps Vietnamese and English names', () => {
    expect(statusBucket('Cần làm')).toBe('TODO');
    expect(statusBucket('Đang làm')).toBe('IN_PROGRESS');
    expect(statusBucket('Đang thực hiện')).toBe('IN_PROGRESS');
    expect(statusBucket('Review')).toBe('REVIEW');
    expect(statusBucket('Đánh giá')).toBe('REVIEW');
    expect(statusBucket('Hoàn thành')).toBe('DONE');
    expect(statusBucket('Done')).toBe('DONE');
  });
});

describe('statusColor', () => {
  it('differs by bucket (not priority palette)', () => {
    expect(statusColor('Cần làm')).toBe('#8590a2');
    expect(statusColor('Đang làm')).toBe('#0c66e4');
    expect(statusColor('Review')).toBe('#6e5dc6');
    expect(statusColor('Hoàn thành')).toBe('#22a06b');
  });
});
