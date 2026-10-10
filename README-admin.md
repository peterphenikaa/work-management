# Phân hệ Admin — tóm tắt để làm API

Đặc tả A01–A07. File này là quy ước nghiệp vụ cho API quản trị. Máy chủ phải kiểm tra danh tính, vai trò, phạm vi Workspace và quyền trên tài nguyên ở **mọi** request. Ẩn nút trên giao diện không phải là phân quyền.

Schema hiện tại chỉ có `User.role` toàn cục (`ADMIN | LEADER | MEMBER`) và `HealthCheck`. Chưa có Workspace, Space, List, Task, lời mời, trạng thái khóa, hay audit log. API admin phải tách các khái niệm dưới đây, không nhét vào một trường `role` hay `status`.

## Phạm vi

| Mã | Chức năng | Actor chính |
|----|-----------|-------------|
| A01 | Dashboard quản trị | Admin |
| A02 | CRUD Workspace, điều hướng Space → List → Task | Admin |
| A03 | Danh sách, tìm, lọc thành viên | Admin |
| A04 | Mời thành viên | Admin (Leader chỉ khi được ủy quyền) |
| A05 | Đổi vai trò | Admin |
| A06 | Khóa / mở khóa tài khoản; gỡ thành viên khỏi Workspace | Admin |
| A07 | Báo cáo tiến độ và xuất file | Admin |

Leader quản lý Space, List và công việc **trong Workspace được giao**. Member chỉ làm việc trong phạm vi được cấp. Hệ thống xác thực, kiểm tra quyền, gửi email, tổng hợp số liệu và ghi nhật ký.

## Ba trạng thái không được gộp

| Khái niệm | Giá trị | Ý nghĩa |
|-----------|---------|---------|
| Trạng thái tài khoản | `ACTIVE`, `LOCKED` | Khả năng đăng nhập toàn hệ thống |
| Tư cách thành viên Workspace | tham gia / đã gỡ / đã rời | Quyền trong một Workspace |
| Trạng thái lời mời | `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED` | Vòng đời lời mời |

Khóa tài khoản khác với gỡ khỏi Workspace, và khác với xóa tài khoản.

## Đối tượng

```
Workspace → Space → List → Task
```

| Đối tượng | Trường bắt buộc để API đúng |
|-----------|------------------------------|
| Workspace | id, name, description, ownerId, accessType `PRIVATE \| PUBLIC`, createdAt. Icon không bắt buộc. Cần `updatedAt`, `memberCount`, trạng thái theo chính sách lưu trữ |
| Space / List | thuộc đúng cha. List thuộc Space trong cùng Workspace |
| Thành viên | userId, họ tên, email, avatar tùy chọn, accountStatus, vai trò theo từng Workspace, workspaceCount |
| Task | id, name, status, assignee, reporter, priority, dueDate (có thể trống) |
| Nhật ký | actor, action, target, thời điểm, kết quả. Không ghi mật khẩu hay token |

Trạng thái Task: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`.

Task **đang trễ hạn**: có `dueDate` nhỏ hơn thời điểm hiện tại và status khác `DONE`. Task không có hạn không được tính là đúng hạn. Task đã hoàn thành trễ là chỉ số riêng, không nằm trong danh sách đang trễ.

## Bốn điểm chưa chốt

Bốn điểm này đổi schema và contract. Phần còn lại của file dùng làm mặc định triển khai.

| Điểm | Mặc định tạm trong đặc tả | Ảnh hưởng API |
|------|---------------------------|----------------|
| Phạm vi Admin | Admin hệ thống, toàn bộ dữ liệu | Mọi query admin không lọc theo “Workspace của tôi”, trừ khi đổi sang Admin theo Workspace |
| Xóa Workspace | Không mặc định xóa cứng. Xóa mềm để còn khôi phục | `DELETE` là soft delete; dữ liệu con không ở trạng thái nửa xóa |
| Lời mời | Có `workspaceId` theo chính sách | Một invitation gắn Workspace + role, không mời “vào hệ thống” rồi mới gán Workspace |
| Tỷ lệ đúng hạn | Đúng hạn / (task đã hoàn thành **có hạn hợp lệ**) | Mẫu số không phải toàn bộ task được giao. Mẫu số = 0 thì trả `null`, UI hiện `—` |

## Quy tắc đếm dùng chung cho Dashboard và báo cáo

Dashboard và báo cáo phải dùng cùng định nghĩa.

- Workspace: chỉ bản chưa xóa.
- Thành viên: đếm **tài khoản duy nhất** trên hệ thống. Không cộng thêm lượt thành viên của từng Workspace vào cùng một số.
- Task: mỗi task một lần trong phạm vi quyền. Không nhân đôi khi đi qua nhiều bộ lọc.
- `completionRate` = completed / total × 100. `total = 0` thì không chia; trả `null` hoặc `0` theo một quy ước và giữ nguyên trên mọi API.
- Task đang trễ khác task hoàn thành trễ.
- Không đưa Workspace mà Admin không được xem vào số liệu.
- Bộ lọc ngày phải ghi rõ mốc: ngày tạo, ngày cập nhật, hay ngày hoàn thành. Nếu client không chọn mốc, response phải trả mốc đang dùng.

## Mã lỗi

| Tình huống | HTTP |
|------------|------|
| Body / query không hợp lệ | 400 |
| Chưa đăng nhập hoặc phiên hết hạn | 401 |
| Không đủ quyền | 403 |
| Không tồn tại hoặc đã xóa | 404 |
| Trùng thành viên, xung đột cập nhật, trạng thái không cho phép | 409 |
| Quá nhiều request | 429 |
| Lỗi ngoài dự kiến | 500 |

Body lỗi không lộ stack, SQL, hay bí mật. Validate ở server kể cả khi UI đã chặn. Chuỗi phải trim. Enum chỉ nhận giá trị đã định nghĩa. Danh sách ID phải loại trùng rồi kiểm tra từng phần tử tồn tại và nằm trong phạm vi quyền.

## A01 — Dashboard

Tiền điều kiện: đã đăng nhập, role Admin.

Chỉ số:

| Trường | Quy tắc |
|--------|---------|
| `totalWorkspaces` | Workspace chưa xóa |
| `totalMembers` | Tài khoản duy nhất |
| `totalTasks` | Task trong phạm vi, không trùng |
| `overdueTasks` | Chưa Done và quá hạn |
| `taskStatus` + `taskCount` | Bốn trạng thái. Có task thì tổng tỷ lệ = 100%. Không có task thì mảng rỗng, không chia 0 |
| `activeMembers`, `lockedMembers` | Theo `accountStatus` |
| `lastUpdatedAt` | Thời điểm tổng hợp |

Thao tác API cần hỗ trợ: lấy dashboard; lọc khoảng thời gian nếu có; làm mới. KPI Workspace, task trễ, và trạng thái thành viên là điều hướng sang A02 / A03 / danh sách task, không phải số liệu riêng.

Khi một phần tổng hợp lỗi: trả lỗi cho phần đó, các phần đã tính vẫn trả được. Không có dữ liệu thì số 0 hoặc trạng thái rỗng, không phải 500.

## A02 — Workspace

### Danh sách

Query: `q` (tên, trim), `accessType`, `ownerId`, `status`, `sort` chỉ trong `name | createdAt | memberCount`, `page`, `pageSize` trong giới hạn. Rỗng thì 200 kèm danh sách trống.

Mỗi item: `workspaceId`, `name`, `icon`, `ownerId`, `ownerName`, `createdAt`, `memberCount`, `accessType`, `status`.

### Tạo

| Trường | Quy tắc |
|--------|---------|
| `name` | Bắt buộc, trim, 1–100 ký tự. Chuỗi trắng → 400 |
| `icon` | Tùy chọn. URL thì phải hợp lệ; mã icon thì phải thuộc danh sách hỗ trợ |
| `description` | Tùy chọn, tối đa 1.000 ký tự |
| `ownerId` | Bắt buộc. User tồn tại và `ACTIVE` |
| `accessType` | `PRIVATE` hoặc `PUBLIC` |
| `initialMembers` | Tùy chọn, không trùng |
| `initialRoles` | Role hợp lệ theo từng thành viên |

Tạo Workspace và quan hệ thành viên trong **một transaction**. Lỗi khi ghi thành viên thì rollback cả Workspace. Chống gửi lặp. Thiếu quyền → 403, không ghi bản ghi.

### Chi tiết và sửa

Trả về: tên, icon, mô tả, accessType, createdAt, updatedAt, owner, danh sách admin của Workspace, cây Space, thành viên kèm role và trạng thái trong Workspace.

| Thao tác | Ràng buộc |
|----------|-----------|
| Sửa tên, icon, mô tả | Validate như lúc tạo |
| Đổi `PRIVATE` / `PUBLIC` | Chỉ hai giá trị đó |
| Đổi owner | User mới tồn tại, active. Không bỏ owner cuối khi chưa chuyển quyền |
| Thêm thành viên | Không tạo quan hệ trùng |
| Gỡ thành viên | Không gỡ owner nếu chưa chuyển quyền |

Cập nhật đồng thời: nếu bản ghi đã đổi, 409 và yêu cầu tải lại. Không ghi đè thầm.

### Cây Space / List / Task

Lazy load theo cấp, phân trang task. Kiểm tra tồn tại trước khi đi tiếp; mất thì 404 và client tải lại cây.

- Space: tạo, sửa tên / icon / cấu hình, xóa. Xóa Space phải xác nhận vì kéo theo List và Task.
- List: tạo, sửa, chuyển sang Space khác **cùng Workspace**, xóa.
- Task trong List: xem bảng hoặc Kanban. Trường: `taskId`, `taskName`, assignee, reporter, status, priority, `dueDate`. Admin được xem chi tiết, đổi assignee / priority / status, chuyển List, xóa task khi có quyền.

Thiếu quyền ở cấp nào thì 403 đúng cấp đó.

### Xóa Workspace

Không xóa chỉ bằng một click. Client gửi tên Workspace khớp chính xác. Server kiểm tra quyền ngay trước khi xóa, ghi audit, soft delete. Dữ liệu liên kết phải theo cùng chính sách, không để bản ghi con trỏ vào Workspace đã xóa mà vẫn còn “sống”.

## A03 — Danh sách thành viên

Mỗi dòng: `userId`, `fullName`, `email`, `avatarUrl`, `accountStatus`, `workspaceRoles[]` (role theo từng Workspace), `workspaceCount`, `joinedAt` theo phạm vi, `lastActiveAt` nếu có.

Query: `q` tên hoặc một phần email (trim, giới hạn độ dài), `accountStatus`, `role`, `workspaceId`, `sort`, `page`, `pageSize`. Giữ bộ lọc khi request lỗi để client thử lại. Không trả user ngoài phạm vi quyền. User đã xóa thì không cho thao tác tiếp.

Mở hồ sơ: chi tiết cộng các hành động A05 và A06 mà caller được phép.

## A04 — Mời thành viên

| Trường | Nguồn |
|--------|--------|
| `email` | Client. Trim, đúng định dạng |
| `workspaceId` | Client. Workspace tồn tại, chưa xóa, chưa khóa, caller được mời trong Workspace đó |
| `role` | Client. Role được phép gán. Không được gán role vượt quyền người mời |
| `message` | Tùy chọn, giới hạn độ dài |
| `invitedBy`, `invitedAt`, `expiresAt` | Server. Không nhận `invitedBy` từ client |
| `invitationStatus` | Server. Bắt đầu `PENDING` |

Luồng: kiểm tra quyền → email → Workspace → role → đã là thành viên chưa → còn lời mời `PENDING` chưa → tạo một lời mời → gửi email hoặc đưa vào hàng đợi.

| Tình huống | Kết quả |
|------------|---------|
| Đã là thành viên | 409, không tạo lời mời mới |
| Đang có lời mời chờ | Trả lời mời hiện có hoặc gửi lại theo một chính sách, không tạo nhiều bản trùng |
| Gửi email lỗi | Giữ một lời mời, đánh dấu lỗi gửi, cho thử lại |
| Hết hạn | Không cho accept. Có API gửi lại |
| Token sai | Từ chối |

Token khó đoán, có hạn. Lúc accept phải kiểm tra lại danh tính, `accountStatus`, Workspace và hạn token tại thời điểm đó.

## A05 — Đổi vai trò

Body: `userId`, `workspaceId`, `newRole`. `reason` nếu chính sách bắt buộc. `changedBy` và `changedAt` do server gán.

Server đọc `currentRole` từ DB, không tin client. Sau khi lưu, request sau dùng role mới. Lưu thất bại thì không trả success; client phải thấy role thật.

Cấm:

- Role lạ.
- Tự nâng quyền vượt phạm vi.
- Leader tự cấp Admin.
- Hạ hoặc gỡ Admin cuối cùng nếu hệ thống mất người quản trị.
- Đổi role làm đổi quyền ở Workspace khác.
- Ghi đè khi người khác vừa đổi (409, tải lại).

Audit bắt buộc: người đổi, thời điểm, role cũ, role mới, Workspace.

### Ma trận

| Việc | Admin hệ thống | Leader | Member |
|------|----------------|--------|--------|
| Dashboard toàn hệ thống | Có | Không | Không |
| CRUD Workspace toàn hệ thống | Có | Không | Không |
| Xóa Workspace | Có, có xác nhận tên | Không | Không |
| Space / List | Theo quyền hệ thống | Trong phạm vi được giao | Theo quyền được cấp |
| Danh sách thành viên | Toàn hệ thống | Workspace được giao | Chỉ thông tin được phép |
| Mời thành viên | Có | Chỉ khi được ủy quyền | Không |
| Đổi role Admin | Theo chính sách đặc biệt | Không | Không |
| Đổi Leader / Member | Có | Chỉ khi được ủy quyền | Không |
| Khóa / mở khóa tài khoản | Có | Không | Không |
| Gỡ khỏi Workspace | Có | Chỉ khi được ủy quyền | Không |
| Xem báo cáo tổ chức | Toàn hệ thống | Phạm vi được giao, nếu có | Không |
| Xuất báo cáo | Có | Theo phạm vi báo cáo | Theo quyền được cấp |

## A06 — Khóa, mở khóa, gỡ thành viên

| Action | Phạm vi | Việc server làm |
|--------|---------|-----------------|
| `LOCK` | Tài khoản | `accountStatus = LOCKED`, chặn đăng nhập, thu hồi phiên / token đang sống, ghi lý do |
| `UNLOCK` | Tài khoản | Chỉ từ `LOCKED` sang `ACTIVE`. Không mở tài khoản đã xóa hoặc bị hạn chế khác |
| `REMOVE_MEMBER` | Một Workspace | Xóa quan hệ thành viên và quyền của Workspace đó. Không xóa `User` |
| Xóa tài khoản | Toàn hệ thống | Thao tác riêng, chưa gộp vào gỡ thành viên |

`performedBy`, `performedAt` do server gán. Không khóa lần hai nếu đã `LOCKED`, trừ khi chỉ cập nhật lý do theo quy trình riêng. Không gỡ owner khi chưa chuyển quyền. Nếu user còn là assignee hoặc chủ tài nguyên, áp dụng quy tắc chuyển giao trước khi gỡ. Thất bại thì rollback và UI phải thấy trạng thái DB.

## A07 — Báo cáo

Mọi KPI, biểu đồ, bảng và file xuất dùng **cùng bộ lọc và cùng công thức**.

### Bộ lọc

`startDate`, `endDate` (`endDate >= startDate`), `workspaceIds`, `spaceIds`, `listIds`, `memberIds`, `assigneeIds`, `reportPeriod` (`day | week | month | custom`), `priority`, `taskStatus`.

- Bỏ trống Workspace: mọi Workspace Admin được xem.
- Bỏ trống ngày: khoảng mặc định đã cấu hình, và response nói rõ khoảng đó.
- Space phải thuộc Workspace đã chọn. List phải thuộc Space đó.
- Nhiều tiêu chí là giao (AND).

### KPI

| Mã | Quy tắc |
|----|---------|
| `totalTasks` | Task duy nhất trong phạm vi |
| `completedTasks` | Status Done |
| `inProgressTasks` | Status In Progress |
| `overdueTasks` | Chưa Done và quá hạn |
| `completionRate` | completed / total. total = 0 thì không chia |
| `onTimeCompletedTasks` | Done và hoàn thành không muộn hơn hạn |
| `lateCompletedTasks` | Done sau hạn |

Task hủy hoặc lưu trữ phải bị loại theo một chính sách cố định trên mọi chỉ số.

### Biểu đồ

Trả series có nhãn: theo status, hoàn thành theo thời gian, đúng hạn / trễ hạn, theo priority, hiệu suất thành viên. Chuỗi rỗng khi không có dữ liệu. Click một nhóm là mở danh sách task của nhóm đó nếu có quyền.

### Bảng task đang trễ

`taskId`, `taskName`, `workspaceName`, `spaceName`, `listName`, `assigneeName`, `reporterName`, `dueDate`, `daysOverdue`, `priority`, `status`.

Chỉ task đang quá hạn. Task Done không có ở đây. Lọc theo Workspace, thành viên, priority, số ngày trễ. Sort theo hạn, priority, hoặc số ngày trễ. Sửa task chỉ khi có quyền.

### Hiệu suất thành viên

`memberId`, `memberName`, `assignedTasks`, `completedTasks`, `onTimeTasks`, `lateTasks`, `overdueOpenTasks`, `onTimeRate`.

`onTimeRate` = onTime / (task Done có hạn hợp lệ). Mẫu số 0 → `null`. `assignedTasks` và `completedTasks` là hai số khác nhau.

### Xuất

`exportFormat`: `XLSX` hoặc `PDF`. Kèm `filters`, `generatedAt`, `generatedBy`, `reportTitle`, `includeCharts` nếu có.

File phải khớp bộ lọc trên màn hình, có tiêu đề, thời điểm xuất và điều kiện lọc. Không xuất dữ liệu ngoài quyền. Dữ liệu rỗng vẫn xuất được file rỗng kèm bộ lọc. Lỗi tạo file thì 500 có thông điệp để thử lại, không trả file hỏng. Dữ liệu lớn thì phân trang hoặc xuất bất đồng bộ. Ô Excel phải được ghi dạng text để chuỗi không bị hiểu thành công thức.

## Audit log

Ghi khi: tạo / sửa / xóa Workspace, đổi owner, mời và thu hồi lời mời, đổi role, khóa / mở khóa, gỡ thành viên, xuất báo cáo quản trị.

Mỗi bản ghi: `auditId`, `actorId`, `action`, `targetType`, `targetId`, `timestamp`, `result`, `reason`, `metadata`. Metadata chỉ chứa diff cần thiết. Cấm mật khẩu, token, cookie. Log không cho client sửa.

## Phi chức năng chạm tới API

- Mọi thao tác quản trị kiểm tra quyền trên server.
- Danh sách phân trang. Không trả full bảng lớn trong một response.
- Nhiều bước ghi (tạo Workspace + thành viên, khóa + thu hồi phiên) nằm trong transaction hoặc có bước bù.
- Dashboard và báo cáo cùng công thức.
- Một chart lỗi không làm hỏng cả payload dashboard.
- Có giới hạn kích thước và thời gian khi xuất file.
