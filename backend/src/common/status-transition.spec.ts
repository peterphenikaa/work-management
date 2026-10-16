import { describe, expect, it } from 'vitest';
import { statusBucket } from './status-bucket.js';

/** Mirror of SpaceService.assertStatusTransition rules for unit coverage. */
function assertTransition(input: {
  from: string;
  to: string;
  assigneeId: string | null;
  attachmentCount: number;
  checks: { done: boolean }[];
}): string | null {
  const from = statusBucket(input.from);
  const to = statusBucket(input.to);
  if (from === to) return null;
  if (to === 'IN_PROGRESS' && !input.assigneeId) {
    return 'Cần gán người thực hiện trước khi chuyển sang Đang làm';
  }
  if (to === 'REVIEW' && input.attachmentCount === 0) {
    return 'Cần đính kèm kết quả/link trước khi gửi Review';
  }
  if (to === 'DONE') {
    if (input.checks.length === 0) {
      return 'Cần có checklist và hoàn thành 100% trước khi đánh dấu xong';
    }
    if (input.checks.some((row) => !row.done)) {
      return 'Checklist phải hoàn thành 100% trước khi chuyển sang Hoàn thành';
    }
  }
  return null;
}

describe('status transition rules', () => {
  it('blocks TODO → IN_PROGRESS without assignee', () => {
    expect(
      assertTransition({
        from: 'Cần làm',
        to: 'Đang làm',
        assigneeId: null,
        attachmentCount: 0,
        checks: [],
      }),
    ).toMatch(/gán người/);
  });

  it('allows TODO → IN_PROGRESS with assignee', () => {
    expect(
      assertTransition({
        from: 'Cần làm',
        to: 'Đang làm',
        assigneeId: 'u1',
        attachmentCount: 0,
        checks: [],
      }),
    ).toBeNull();
  });

  it('blocks IN_PROGRESS → REVIEW without attachment', () => {
    expect(
      assertTransition({
        from: 'Đang làm',
        to: 'Review',
        assigneeId: 'u1',
        attachmentCount: 0,
        checks: [],
      }),
    ).toMatch(/đính kèm/);
  });

  it('blocks → DONE without full checklist', () => {
    expect(
      assertTransition({
        from: 'Review',
        to: 'Hoàn thành',
        assigneeId: 'u1',
        attachmentCount: 1,
        checks: [],
      }),
    ).toMatch(/checklist/i);
    expect(
      assertTransition({
        from: 'Review',
        to: 'Hoàn thành',
        assigneeId: 'u1',
        attachmentCount: 1,
        checks: [{ done: false }],
      }),
    ).toMatch(/100%/);
  });

  it('allows → DONE with all checks done', () => {
    expect(
      assertTransition({
        from: 'Review',
        to: 'Hoàn thành',
        assigneeId: 'u1',
        attachmentCount: 1,
        checks: [{ done: true }],
      }),
    ).toBeNull();
  });
});
