# Click Up — Website Quản lý Công việc Nhóm

Đồ án liên ngành: xây dựng website quản lý công việc nhóm theo mô hình **ClickUp** (Tasks · cấu trúc Workspace · Kanban/List · Sprint Agile · báo cáo).

> Yêu cầu cô: tìm hiểu ClickUp → chuyển sang bài của mình (nghiệp vụ, tác nhân, usecase) → triển khai sản phẩm tương đương ClickUp cho quản lý công việc nhóm.

---

## 1. Mục tiêu sản phẩm

Tối ưu quy trình giao việc, theo dõi tiến độ và nâng cao hiệu suất làm việc nhóm. Người dùng làm việc trong không gian giống ClickUp:

| ClickUp | Bản đồ sang hệ thống của nhóm |
|---------|--------------------------------|
| Workspace | Không gian tổ chức / lớp / công ty |
| Space & List | Dự án / phòng ban & danh sách task |
| Tasks | Công việc: assignee, due date, priority, tags |
| Board / List | Kanban + List View |
| Docs / Chat (rút gọn) | Comment, @mention, đính kèm file trong Task |
| Goals (rút gọn) | Báo cáo % hoàn thành, task trễ hạn |
| Agile | Product Backlog + Sprint 2 tuần |

**Phạm vi MVP (ưu tiên đồ án):** Auth · Workspace hierarchy · Task core · Board/List · Comment/file · Báo cáo · Sprint/Backlog.  
**Chưa làm (phase sau):** Docs realtime kiểu ClickUp Docs, Chat riêng, Goals OKR đầy đủ.

---

## 2. Nghiệp vụ cốt lõi

### 2.1. Cấu trúc không gian (Workspace Hierarchy)

```
Workspace  →  Space  →  List  →  Task
```

- **Workspace:** cấp cao nhất (tổ chức / nhóm đồ án).
- **Space & List:** chia Workspace thành dự án/phòng ban và danh sách công việc.

### 2.2. Quản lý công việc (Task)

CRUD + lưu trữ. Mỗi Task gồm:

- Tên, mô tả
- Assignee (người thực hiện)
- Start / Due date
- Priority: `Low | Medium | High | Urgent`
- Tags

### 2.3. Tiến độ & trạng thái

Trạng thái: `To Do` → `In Progress` → `Review` → `Done`

Hai góc nhìn:

- **Kanban Board** (kéo-thả)
- **List View**

### 2.4. Tương tác nhóm

Comment, `@mention`, đính kèm file ngay trong chi tiết Task.

### 2.5. Thành viên & báo cáo

Phân quyền theo vai trò; báo cáo tỷ lệ hoàn thành theo dự án / cá nhân; task trễ hạn.

### 2.6. Agile & Sprint (chu kỳ 2 tuần)

| Quy tắc | Nội dung |
|---------|----------|
| Product Backlog | Task chưa vào Sprint |
| Sprint Planning | Chia Space thành chu kỳ ~2 tuần; kéo Task từ Backlog → Sprint |
| **Ràng buộc Active** | Mỗi Space **chỉ 1 Sprint Active** tại một thời điểm |
| **Đóng Sprint** | Chỉ Complete khi **100% Task trong Sprint = Done**; nếu còn dở → gợi ý chuyển về Backlog hoặc Sprint sau |

---

## 3. Tác nhân (Actors)

| Vai trò | Quyền chính |
|---------|-------------|
| **Admin / Workspace Owner** | Quản lý Workspace, phân quyền, quản lý thành viên, xem báo cáo toàn cục |
| **Leader / Project Manager** | Tạo Space/List, phân công Task, hạn chót, Sprint planning, duyệt kết quả |
| **Member** | Nhận việc, cập nhật trạng thái, comment, đính kèm file |

---

## 4. Use Case theo phân hệ

### Phân hệ 1 — Quản trị & tài khoản

| UC | Tên | Actor | Mô tả ngắn |
|----|-----|-------|------------|
| UC01 | Đăng ký / Đăng nhập / Quên MK | All | Xác thực; sai thông tin → cảnh báo |
| UC02 | Quản lý thông tin cá nhân | All | Họ tên, avatar, SĐT, đổi mật khẩu |
| UC03 | Quản lý thành viên & phân quyền | Admin | Đổi role Member↔Leader, khóa tài khoản |

### Phân hệ 2 — Cấu trúc dự án

| UC | Tên | Actor | Mô tả ngắn |
|----|-----|-------|------------|
| UC04 | CRUD Workspace | Admin | Tạo Workspace (tên, icon) |
| UC05 | CRUD Space / List | Leader | Tổ chức dự án + quyền riêng tư |

### Phân hệ 3 — Công việc (cốt lõi)

| UC | Tên | Actor | Mô tả ngắn |
|----|-----|-------|------------|
| UC06 | Tạo Task | Leader, Member | Tạo trong List; tên bắt buộc |
| UC07 | Assign Task | Leader | Gán người + thông báo |
| UC08 | Update Status | Member, Leader | Dropdown hoặc kéo-thả Kanban |
| UC09 | Due date & Priority | Leader, Member | Hạn + mức ưu tiên |
| UC10 | Search & Filter | All | Theo từ khóa, tag, assignee |

### Phân hệ 4 — Tương tác & báo cáo

| UC | Tên | Actor | Mô tả ngắn |
|----|-----|-------|------------|
| UC11 | Comment & đính kèm | Member, Leader | Trao đổi + file trong Task |
| UC12 | Board / List View | All | Đổi góc nhìn dữ liệu |
| UC13 | Báo cáo tiến độ | Leader, Admin | % Done, task trễ hạn (biểu đồ) |

### Phân hệ 5 — Agile & Sprint

| UC | Tên | Actor | Mô tả ngắn |
|----|-----|-------|------------|
| UC14 | Product Backlog | Leader, Member | Task không chọn Sprint → Backlog |
| UC15 | Sprint Planning | Leader | Tạo Sprint 2 tuần; kéo Task từ Backlog |
| UC16 | Start / Complete Sprint | Leader | Start chỉ khi chưa có Active; Complete khi 100% Done |

**Sơ đồ cần có trong báo cáo:** UC tổng quan · UC01–02 · phân rã Leader · phân rã Admin · Sequence UC15–16 · Class/ERD (có `Sprint`, `Backlog`, `Task.sprintId`).

---

## 5. Hướng triển khai kỹ thuật (đáp ứng nghiệp vụ)

### 5.1. Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js (App Router) · Tailwind · shadcn/ui |
| Backend | NestJS · REST `/api` |
| ORM / DB | Prisma · Supabase PostgreSQL (DB production, app chạy local) |
| Auth (dự kiến) | JWT / session + role claim (`ADMIN` \| `LEADER` \| `MEMBER`) |
| File | Supabase Storage (đính kèm Task) |
| Realtime (optional) | Supabase Realtime cho comment |

### 5.2. Domain model (skeleton)

```
User ──< WorkspaceMember >── Workspace
Workspace ──< Space ──< List ──< Task
Task ──< Comment / Attachment / Tag
Space ──< Sprint
Task.sprintId?  (null = Backlog)
```

Ràng buộc nghiệp vụ enforce ở **service NestJS** (không chỉ UI):

- Một Space ≤ 1 Sprint `ACTIVE`
- Complete Sprint chỉ khi mọi Task thuộc Sprint = `DONE`
- Phân quyền theo role trên từng API

### 5.3. Roadmap module → Use Case

| Phase | Module | UC phủ | UI chính |
|-------|--------|--------|----------|
| **P0** | Auth + Profile | UC01–02 | Login / Register / Settings |
| **P1** | Workspace / Space / List + Members | UC03–05 | Sidebar hierarchy kiểu ClickUp |
| **P2** | Task CRUD + Assign + Status + Priority/Due + Filter | UC06–10 | Task detail drawer |
| **P3** | Board + List View | UC08, UC12 | Kanban dnd + bảng List |
| **P4** | Comment + Upload | UC11 | Thread trong Task |
| **P5** | Sprint + Backlog | UC14–16 | Backlog board + Sprint panel |
| **P6** | Reports | UC13 | Dashboard % Done / overdue |

### 5.4. Mapping màn hình “như ClickUp”

1. **Home / Workspace switcher** — chọn Workspace  
2. **Sidebar** — Space → List (như ClickUp left nav)  
3. **List header** — tabs Board | List | (Sprint)  
4. **Task modal/drawer** — mô tả, assignee, dates, priority, tags, comments, files  
5. **Backlog & Sprint** — cột Backlog + Sprint Active; drag Task  
6. **Reports** — charts hoàn thành / trễ hạn  

### 5.5. API skeleton (định hướng)

```
/api/auth/*
/api/workspaces, /spaces, /lists
/api/tasks, /tasks/:id/comments, /tasks/:id/attachments
/api/sprints, /sprints/:id/start, /sprints/:id/complete
/api/reports/progress
/api/health
```

---

## 6. Cấu trúc repo & chạy local

```
frontend/   Next.js + shadcn + Tailwind   → http://localhost:3000
backend/    NestJS + Prisma               → http://localhost:3001/api
```

App **local**, DB **Supabase production**.

### Setup

```bash
# Backend
cd backend
cp .env.example .env          # dán DATABASE_URL Supabase (Session :5432 + sslmode=require)
npm install --legacy-peer-deps
npx prisma generate
# Nếu DB đã có schema: npx prisma db pull && npx prisma generate
npm run start:dev

# Frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Từ root: `npm run dev:backend` / `npm run dev:frontend` / `npm run dev` (cả hai).

**Lưu ý:** không `migrate` lên production trừ khi chủ đích đổi schema. Health: `GET /api/health`.

---

## 7. Tiêu chí nghiệm thu (bám yêu cầu cô)

- [ ] Có đủ **nghiệp vụ · tác nhân · usecase** (bản này + báo cáo)
- [ ] Sản phẩm dùng được như ClickUp thu nhỏ: hierarchy + task + board/list
- [ ] Role Admin / Leader / Member hoạt động đúng
- [ ] Sprint: 1 Active / Space + điều kiện đóng Sprint
- [ ] Comment + file trong Task
- [ ] Báo cáo tiến độ cơ bản

---

## 8. Trạng thái hiện tại (base kỹ thuật)

Đã scaffold:

- Frontend Next.js + Tailwind + shadcn (button, card, input, label) + health UI
- Backend NestJS + Prisma + CORS + `GET /api`, `GET /api/health`

**Tiếp theo:** nhận `DATABASE_URL` → `db pull` / thiết kế schema theo ERD mục 5.2 → Auth (P0) → hierarchy (P1) → Task core (P2).
