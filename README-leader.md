# Phân hệ Leader — hợp đồng API theo màn hình

Đặc tả L01–L12. File này là quy ước để nhóm màn Leader làm API. Mọi request phải kiểm tra danh tính, vai trò và phạm vi trên server. Ẩn nút trên giao diện không phải là phân quyền.

Base URL: `/api`. Xác thực bằng cookie `access_token` (`credentials: include`). Body JSON, trừ upload file.

## Phạm vi Leader

Leader tổ chức Space và List, tạo và phân công Task, lập Product Backlog và Sprint, theo dõi tiến độ, nghiệm thu và xem báo cáo **trong Workspace được giao**.

Tài khoản chỉ có hai role hệ thống: `ADMIN` và `MEMBER`. Không có tài khoản role leader. Leader là ghế `WorkspaceMember.role = LEADER` sau khi được mời vào một workspace. Tài khoản `MEMBER` chưa được mời thì không có workspace để dùng quyền đó.

Leader không quản trị tài khoản toàn hệ thống (`/workspaces/people`, khóa, xóa user, đổi role hệ thống). Không đọc Workspace hoặc Space ngoài phạm vi.

| Vai trò | Phạm vi |
|---------|---------|
| Admin hệ thống | `User.role = ADMIN`. Toàn bộ dữ liệu và màn quản trị. Tạo workspace và mời quản trị workspace |
| Quản trị workspace | `WorkspaceMember.role = ADMIN` trong workspace đó, dù tài khoản là role nào. Mời leader |
| Leader | `WorkspaceMember.role = LEADER`. Mọi Space trong workspace được mời. Mời thành viên |
| Thành viên | `WorkspaceMember.role = MEMBER`. Task được giao, trong Space `PUBLIC` của workspace mình thuộc, hoặc Space `PRIVATE` mà mình có trong `SpaceMember` |

Mặc định đã chốt để làm API (mục 9 của đặc tả):

| Câu hỏi | Mặc định |
|---------|----------|
| Leader quản lý Space nào? | Mọi Space trong Workspace mình là Leader hoặc owner. Không cần gán từng Space |
| Task và Sprint | Task thuộc một List. Sprint là thực thể riêng, gắn Task bằng `sprintId`. Một Task thuộc tối đa một Sprint. List không phải Sprint |
| Workflow | Trạng thái là danh sách do Space cấu hình. Được chuyển tới bất kỳ `statusId` thuộc Space đó. Không bắt buộc đi qua Review |
| Hoàn thành | Tên trạng thái chứa `hoàn`, bằng `done`, hoặc chứa `xong` thì tính là Done. Cùng một hàm cho Dashboard, Board và báo cáo |
| Sprint Active | Mỗi Space tối đa một Sprint `ACTIVE` |
| Đóng Sprint | Không đóng khi còn Task chưa Done, trừ khi body chỉ rõ từng task về Backlog hoặc sang Sprint khác |
| Xóa | Space, List, Task dùng `deletedAt`. Không xóa cứng. Chưa có trạng thái lưu trữ riêng; đừng dùng xóa mềm thay cho “ẩn tạm” nếu sau này cần khôi phục khác xóa |
| Hiệu suất | Đếm số Task, đúng hạn, trễ hạn, đang quá hạn. Chưa có Story Points |

## Những gì server đã có

Các route dưới đây **đang chạy**, nhưng hầu hết `assertAdmin` nên Leader gọi sẽ nhận **403**. Việc của API Leader là mở các route này theo phạm vi ở trên, không viết lại công thức.

| Việc | Method và đường dẫn | Ghi chú |
|------|---------------------|---------|
| Phiên | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Dùng chung |
| Workspace mình thuộc | `GET /workspaces` | Hiện trả mọi Workspace cho Admin. Leader chỉ nhận Workspace trong phạm vi |
| Chi tiết Workspace | `GET /workspaces/:id` | |
| Thành viên Workspace | `GET /workspaces/:id/members` | Nguồn chọn assignee |
| Lời mời của Workspace | `GET/POST /workspaces/:id/invitations`, `PATCH/DELETE .../invitations/:invitationId` | Leader được mời vào Workspace mình quản lý. Không mời vào hệ thống |
| Cây Space | `GET /workspaces/:id/spaces` | |
| Tạo / sửa Space | `POST /workspaces/:id/spaces`, `PATCH /workspaces/:id/spaces/:spaceId` | |
| Chi tiết Space (statuses, members, lists, tasks) | `GET /workspaces/:id/spaces/:spaceId` | Board và List View đang đọc endpoint này |
| Tạo / sửa List | `POST .../lists`, `PATCH .../lists/:listId` | `spaceId` trong PATCH là di chuyển List trong cùng Workspace |
| Tạo / sửa Task | `POST .../tasks`, `PATCH .../tasks/:taskId` | |
| Báo cáo | `GET /reports`, `GET /reports/export` | Leader đã bị lọc theo Workspace của mình. Chưa lọc theo Sprint |
| Dashboard Admin | `GET /dashboard` | Số toàn hệ thống. **Không** dùng cho L01 |

Chưa có bảng và route: Sprint, Backlog độc lập, bình luận, checklist, file đính kèm, ngày bắt đầu Task, lịch sử riêng của Task, thông báo.

## Mã lỗi

| Tình huống | HTTP |
|------------|------|
| Body hoặc query không hợp lệ, tên trắng, hạn trước ngày bắt đầu, trạng thái không thuộc Space | 400 |
| Chưa đăng nhập | 401 |
| Ngoài phạm vi Leader | 403 |
| Không tồn tại hoặc đã xóa | 404 |
| Sprint Active thứ hai, đóng Sprint khi còn task chưa xử lý, xung đột cập nhật | 409 |
| Lỗi ngoài dự kiến | 500 |

Chuỗi phải trim. Enum chỉ nhận giá trị đã định nghĩa. Danh sách id phải bỏ trùng, rồi kiểm tra từng phần tử tồn tại và nằm trong phạm vi.

## Công thức dùng chung

- Task quá hạn: có `dueAt` nhỏ hơn hiện tại và trạng thái không phải Done. Task không hạn không tính quá hạn và không tính đúng hạn.
- `completionRate` = số Done / tổng Task trong phạm vi. Tổng = 0 thì trả `null`, UI hiện `—` hoặc “chưa có dữ liệu”. Không trả 500.
- `onTimeRate` = số Done có hạn và `updatedAt <= dueAt`, chia cho số Done có hạn. Mẫu số 0 thì `null`.
- Đổi bộ lọc thì KPI, biểu đồ và bảng phải cùng một phạm vi.
- Task đã xóa (`deletedAt` khác null) không vào bất kỳ số liệu nào.

---

## L01 — Dashboard dự án

Mục đích: KPI và cảnh báo trong phạm vi Leader.

`GET /dashboard` hiện tại là dashboard Admin. L01 cần endpoint riêng.

### Cần làm

`GET /leader/dashboard`

Query: `workspaceId`, `spaceId`, `sprintId`, `period` = `7d | 30d | month | quarter`. Bỏ trống thì mọi Workspace Leader được xem, kỳ mặc định 30 ngày. Response phải trả lại bộ lọc đã áp dụng và `startDate`, `endDate`.

| Mã | Trường | Quy tắc |
|----|--------|---------|
| L01.01 | `totalTasks`, `completedTasks`, `inProgressTasks`, `overdueTasks` | Trong phạm vi và kỳ |
| L01.02 | `completionRate` | Theo công thức chung. Có thể kèm tỷ lệ theo từng Space |
| L01.03 | `statusDistribution[]` | `{ name, count, percent }` theo trạng thái thật của Space, không ép 4 enum |
| L01.04 | `overdueTasks[]` | Chưa Done, đã quá hạn. Kèm `taskId`, `code`, `title`, `spaceId`, `dueAt`, `daysOverdue` để mở L08 |
| L01.05 | `dueSoonTasks[]` | Chưa Done, `dueAt` trong 7 ngày tới. Chưa có cấu hình kỳ riêng |
| L01.06 | `activity[]` | Tạo, sửa, phân công, đổi trạng thái Task. Tạm đọc `AuditLog` lọc theo Workspace của Leader |
| L01.07 | id trên từng dòng | Client tự điều hướng. API không trả URL |
| L01.08 | các query trên | Đổi filter thì toàn bộ payload đổi theo |

Không có task thì các mảng rỗng và rate `null`, không phải 500.

## L02 — Cây Workspace → Space → List

### Đã có, cần mở cho Leader

| Mã | API |
|----|-----|
| L02.01 | `GET /workspaces` rồi `GET /workspaces/:id/spaces`. List nằm trong `GET /workspaces/:id/spaces/:spaceId` (`lists[]` có `taskCount`) |
| L02.02 | Cùng GET space: `name`, `description`, `icon`, `color`, `accessType`, `views` |
| L02.06 | `lists[]` của GET space |

### Cần làm

| Mã | API | Quy tắc |
|----|-----|---------|
| L02.03 L02.04 | Dùng POST/PATCH space ở L03 | |
| L02.05 | `DELETE /workspaces/:id/spaces/:spaceId` | Xóa mềm. Còn task thì 409 kèm số task, trừ khi `?confirm=true` |
| L02.07–L02.10 | L04 | |
| L02.11 | `GET /leader/structure?q=` | Tìm Space và List theo tên, chỉ trong phạm vi. Rỗng thì 200 và `items: []` |

Leader không được `POST /workspaces` hay xóa Workspace.

## L03 — Tạo / sửa Space

### Đã có

`POST /workspaces/:workspaceId/spaces`

`PATCH /workspaces/:workspaceId/spaces/:spaceId`

Body tạo:

| Trường | Quy tắc |
|--------|---------|
| `name` | Bắt buộc, trim, 1–80 |
| `description` | Tùy chọn, tối đa 1.000 |
| `icon` | `ARCHIVE \| BOARD \| SPARK \| REPORTS \| MEMBERS` |
| `color` | `BLUE \| PURPLE \| TEAL \| ORANGE` |
| `accessType` | `PRIVATE \| PUBLIC`. Public nghĩa là mọi thành viên Workspace xem được. Không có nghĩa là người ngoài Workspace |
| `memberIds` | User đang `ACTIVE` trong Workspace. Private mà rỗng thì 400 |
| `statuses` | 1–12 tên, không trùng, không trắng. Thứ tự mảng là `position` |
| `views` | Ít nhất một trong `KANBAN`, `LIST`, `CALENDAR`, `AGILE` |

PATCH gửi `statuses` dạng `{ id?, name }[]`. Đổi tên giữ id. Bỏ một trạng thái đang có task thì 409. Thêm phần tử không id là trạng thái mới.

L03.07 hủy là việc của client, không có API.

## L04 — List

### Đã có

| Mã | API |
|----|-----|
| L04.01 | `lists[]` trong GET space: `id`, `name`, `description`, `taskCount` |
| L04.02 | `POST /workspaces/:workspaceId/spaces/:spaceId/lists` body `{ name, description? }`. Tên 1–80, không trắng |
| L04.03 L04.04 | `PATCH .../lists/:listId` body `{ name, description }` |
| L04.06 | Cùng PATCH, thêm `spaceId` đích. Đích phải cùng Workspace và Leader có quyền cả hai. Task đi theo List. Trạng thái được map theo tên; không có tên trùng thì về trạng thái đầu tiên của Space đích |

### Cần làm

| Mã | API | Quy tắc |
|----|-----|---------|
| L04.05 | `PATCH /workspaces/:workspaceId/spaces/:spaceId/lists/reorder` body `{ listIds: string[] }` | Đủ và chỉ các List đang hoạt động của Space. Ghi `position` theo thứ tự mảng |
| L04.07 | Chưa làm. Đừng dùng DELETE cho “lưu trữ” | Khi làm: `archivedAt`, List biến mất khỏi Board mặc định, task vẫn còn |
| L04.08 | `DELETE .../lists/:listId` | Xóa mềm. Còn task thì 409, trừ `?confirm=true` (task cũng `deletedAt`) |

Không tạo List nếu Space không tồn tại, đã xóa, hoặc Leader không có quyền.

## L05 — Kanban

Đọc `GET /workspaces/:id/spaces/:spaceId`. Cột = `statuses` theo `position`. Thẻ = `tasks`.

Mỗi task hiện có: `id`, `code`, `title`, `description`, `listId`, `listName`, `statusId`, `priority`, `assigneeId`, `assigneeName`, `reporterId`, `reporterName`, `dueAt`, `position`.

| Mã | Cách làm |
|----|----------|
| L05.01 | Client nhóm `tasks` theo `statusId` |
| L05.02 | Lọc client được khi đã tải cả Space. Khi Task nhiều, dùng query của L06 |
| L05.03 L05.06 | Mở L08. Sửa bằng PATCH task |
| L05.04 | `PATCH .../tasks/:taskId` body `{ statusId }`. `statusId` phải thuộc Space. Lỗi thì không đổi dữ liệu |
| L05.05 | `POST .../tasks` với `statusId` của cột và `listId` đang chọn |
| L05.07 | `dueAt < now` và trạng thái chưa Done. Client tô thẻ; server vẫn là nơi tính |
| L05.08 | Gọi lại GET space sau khi lưu. Chưa có websocket |

`priority`: `URGENT | HIGH | MEDIUM | LOW`.

## L06 — List View

GET space đang trả mọi task, không tìm, không phân trang.

### Cần làm

`GET /workspaces/:workspaceId/spaces/:spaceId/tasks`

Query: `q` (tên hoặc `code`), `listId`, `statusId`, `priority`, `assigneeId`, `due` = `overdue | today | week | none`, `sort` = `title | dueAt | priority | createdAt`, `order` = `asc | desc`, `page`, `pageSize` tối đa 50.

Các điều kiện là AND. Đổi trang không được bỏ lọc. Chỉ task Leader được xem. 200 kèm `{ items, page, pageSize, total }`.

Cập nhật nhanh dùng PATCH task. Chọn cột hiển thị là việc của client, không lưu server cho đến khi có yêu cầu riêng.

## L07 — Tạo / sửa Task

### Đã có

`POST /workspaces/:workspaceId/spaces/:spaceId/tasks`

`PATCH /workspaces/:workspaceId/spaces/:spaceId/tasks/:taskId`

| Trường | Quy tắc |
|--------|---------|
| `listId` | Bắt buộc khi tạo. List chưa xóa, thuộc Space này |
| `title` | Bắt buộc, trim, 1–200 |
| `description` | Tùy chọn, tối đa 4.000 |
| `statusId` | Thuộc Space. Bỏ trống khi tạo thì lấy trạng thái `position` nhỏ nhất |
| `priority` | Mặc định `MEDIUM` |
| `assigneeId` | `null` hoặc user thuộc Space (`SpaceMember`, hoặc mọi member Workspace nếu Space `PUBLIC`) |
| `dueAt` | ISO 8601 hoặc `null` |
| `reporterId` | Tùy chọn. Bỏ trống thì người đang đăng nhập |

PATCH chỉ gửi trường đổi. Bấm lưu hai lần không được tạo hai task: client disable nút trong lúc request; server không có idempotency key.

### Chưa có

| Mã | Việc |
|----|------|
| L07.06 ngày bắt đầu | Thêm `startAt`. Nếu cả `startAt` và `dueAt` có giá trị thì `dueAt >= startAt`, không thì 400 |
| L07.08 file | Chưa có bảng file. Khi làm: `POST .../tasks/:taskId/files`, giới hạn loại và dung lượng cần được chốt |
| L07.10 hủy | Client |

Form sửa phải GET task trước (L08) rồi mới hiện dữ liệu cũ.

## L08 — Chi tiết Task và phân công

### Đã có một phần

GET space đã chứa đủ field để vẽ chi tiết. Nên có endpoint một task để màn sửa không phụ thuộc cả board:

`GET /workspaces/:workspaceId/spaces/:spaceId/tasks/:taskId`

Trả cùng shape một phần tử `tasks[]` của GET space, cộng `description`.

| Mã | API |
|----|-----|
| L08.01 L08.02 | GET task |
| L08.03 L08.04 | PATCH `{ assigneeId }`. Người mới phải hợp lệ như L07. Ghi `AuditLog` action `TASK_ASSIGN` với assignee cũ và mới |
| L08.09 | PATCH `{ statusId }` tới trạng thái Done của Space. Không có bước Review bắt buộc |

### Cần làm

| Mã | API | Quy tắc |
|----|-----|---------|
| L08.05 checklist | `GET/POST /tasks/:taskId/checks`, `PATCH /checks/:checkId` `{ title?, done? }` | Tiến độ = số `done` / tổng. Chưa có bảng |
| L08.06 L08.07 | `GET/POST /tasks/:taskId/comments` body `{ body }` | Tag là text `@tên` trong body. Chưa gửi thông báo cho đến khi BR-L11 được bật |
| L08.08 | Xem L07.08 | |
| L08.10 | `GET /tasks/:taskId/activity` | Đọc `AuditLog` có `targetId = taskId` |

Member được PATCH trạng thái và checklist của task mình được giao. Không được đổi assignee, xóa task, hay sửa cấu trúc Space.

## L09 — Product Backlog

Backlog là Task có `sprintId = null` trong Space. Không suy từ trạng thái “Cần làm”.

### Cần làm

`GET /workspaces/:workspaceId/spaces/:spaceId/backlog`

Query: `q`, `priority`, `statusId`. Mỗi item có `planning`: `BACKLOG` khi `sprintId` null, `PLANNED` khi sprint `PLANNED`, `ACTIVE` khi sprint `ACTIVE`.

| Mã | API |
|----|-----|
| L09.02 L09.03 | POST/PATCH task. Tạo từ backlog thì không gửi `sprintId` |
| L09.04 | `PATCH .../backlog/reorder` body `{ taskIds }` ghi `position` |
| L09.05 | Query của GET backlog |
| L09.06 | `POST /sprints/:sprintId/tasks` body `{ taskIds }`. Sprint không được `CLOSED` |
| L09.07 | `DELETE /sprints/:sprintId/tasks/:taskId` đặt `sprintId = null`, giữ lịch sử task |

Một task chỉ một `sprintId`.

## L10 — Lập kế hoạch Sprint

### Cần làm

`GET /workspaces/:workspaceId/spaces/:spaceId/sprints`

Mỗi item: `id`, `name`, `goal`, `startAt`, `endAt`, `status` = `PLANNED | ACTIVE | CLOSED`, `taskCount`, `completedCount`.

`POST .../sprints` body:

| Trường | Quy tắc |
|--------|---------|
| `name` | Bắt buộc, trim, 1–80 |
| `goal` | Tùy chọn, tối đa 1.000 |
| `startAt`, `endAt` | Bắt buộc, `endAt` sau `startAt` |
| `taskIds` | Tùy chọn, task backlog của Space, chưa xóa, Leader còn quyền |

`PATCH /sprints/:sprintId` sửa tên, goal, ngày, và danh sách task khi status là `PLANNED`. Sprint `ACTIVE` chỉ sửa `goal` trừ khi có chính sách đổi phạm vi. Sprint `CLOSED` thì 409.

`DELETE /sprints/:sprintId/tasks/:taskId` gỡ task khi sprint chưa `CLOSED`.

Chưa có Story Points. Không nhận field ước lượng cho đến khi có cột riêng.

Thời lượng gợi ý 14 ngày là mặc định của form, không phải luật server. Server chỉ kiểm tra `endAt > startAt`.

## L11 — Vòng đời Sprint

| Mã | API | Quy tắc |
|----|-----|---------|
| L11.01 L11.04 | `GET /sprints/:sprintId` | Goal, ngày, status, tasks, `completedCount`, `openCount` |
| L11.02 L11.03 | `POST /sprints/:sprintId/start` | Chỉ từ `PLANNED`. Space đã có sprint `ACTIVE` thì 409. Ghi `startedAt`, `startedBy` |
| L11.05 L11.06 L11.07 | `POST /sprints/:sprintId/close` | Chỉ từ `ACTIVE`. Body `{ leftovers: [{ taskId, to: "backlog" \| sprintId }] }` phải phủ mọi task chưa Done. Thiếu thì 409 kèm danh sách task còn mở. Xong thì status `CLOSED`, `closedAt`, `closedBy` |
| L11.08 | GET sprint sau khi đóng, hoặc báo cáo L12 với `sprintId` | |
| L11.09 | `startedAt`, `startedBy`, `closedAt`, `closedBy` và một dòng `AuditLog` | |

## L12 — Báo cáo

### Đã có

`GET /reports?period&workspaceId&spaceId&assigneeId`

`GET /reports/export` cùng query, file `.xls`.

Leader đã bị giới hạn Workspace. Admin thấy tất cả. Member nhận 403.

Payload: `applied` (kèm `rangeLabel`, `startDate`, `endDate`), `kpis` (`totalTasks`, `completedTasks`, `inProgressTasks`, `overdueTasks`, `completionRate`), `statusDistribution`, `trend`, `members` (`assignedTasks`, `completedTasks`, `onTimeTasks`, `lateTasks`, `overdueOpenTasks`, `onTimeRate`), `overdueTasks`, `completedTasks`.

PDF là hộp thoại in của trình duyệt, không phải file từ server.

### Cần bổ sung

| Mã | Việc |
|----|------|
| L12.04 | Query `sprintId`. Bỏ `period` khi có sprint, hoặc giao kỳ với sprint và ghi rõ trong `applied` |
| L12.07 | `GET /reports/sprints?spaceId=` trả mỗi sprint `completedTasks`, `openTasks`, `completionRate` để so sánh. Không bịa số khi sprint không có task |
| L12.06 | Giữ nguyên các filter hiện có, thêm `sprintId` |

Báo cáo không chấm hiệu suất chỉ bằng số lượng. Response đã tách được giao, hoàn thành, đúng hạn, đang quá hạn. Chưa có Story Points.

## Nhật ký

Các thao tác ghi của Leader phải có `AuditLog`: tạo/sửa/xóa Space và List, tạo/sửa Task, đổi trạng thái, đổi assignee, start/close Sprint, xuất báo cáo.

Mỗi dòng: `actorId`, `action`, `targetType`, `targetId`, `result`, `metadata` chỉ gồm diff cần thiết. Không ghi mật khẩu, token, cookie.

## Việc không thuộc Leader

Không làm trong API Leader: khóa tài khoản, xóa user, đổi `User.role`, danh sách mọi user hệ thống, dashboard `/dashboard`.
