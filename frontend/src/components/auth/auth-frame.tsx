export const authFieldClass =
  "h-11 w-full rounded-lg border border-[#dfe1e6] bg-white px-3 text-sm text-[#172b4d] outline-none transition placeholder:text-[#a5adba] focus:border-[#0c66e4] focus:shadow-[0_0_0_3px_rgba(12,102,228,0.16)]";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid h-dvh min-h-0 flex-1 overflow-hidden bg-[#f4f5f7] text-[#172b4d] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <aside className="relative hidden overflow-hidden bg-[#071a3d] text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-[#0c66e4]/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-20 size-72 rounded-full bg-[#1d7afc]/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white text-base font-bold text-[#0c66e4]">
            W
          </span>
          <span className="text-lg font-semibold tracking-tight">Northstar Work</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-sm font-medium tracking-wide text-[#8fb8ff]">Không gian làm việc</p>
          <h2 className="mt-3 text-4xl leading-tight font-semibold tracking-tight">
            Công việc của nhóm, nhìn thấy từ một chỗ.
          </h2>
          <ul className="mt-8 space-y-4 text-sm leading-6 text-[#d6e4ff]">
            <li>Workspace và space cho từng nhóm.</li>
            <li>Task có trạng thái, hạn và người phụ trách.</li>
            <li>Báo cáo tiến độ trên cùng dữ liệu đang làm.</li>
          </ul>
        </div>
        <p className="relative text-sm text-[#9bb0d1]">Northstar · quản lý công việc nội bộ</p>
      </aside>

      <section className="flex min-h-0 flex-col items-center justify-center overflow-y-auto px-5 py-8">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid size-9 place-items-center rounded-xl bg-[#0c66e4] text-sm font-bold text-white">
            W
          </span>
          <span className="text-lg font-semibold tracking-tight">Northstar Work</span>
        </div>
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </main>
  );
}
