# 民宿房态管理 App 开发文档

## 1. 项目目标

开发一个仅在 iPhone 本地使用的简洁民宿房态管理 App，用来替代 Excel 色块管理。

核心目标只有一个：

> 打开 App 后，能快速看清哪个房间有人住、住的是谁、住多久，以及未来哪些日期仍然空置。

第一版不做账号、不做服务器、不做云同步、不做复杂统计，只保留日常最常用的房态管理功能。

---

## 2. 平台与技术方案

- 平台：iPhone
- 开发语言：Swift
- UI：SwiftUI
- 本地数据：SwiftData
- 架构：轻量 MVVM
- 数据范围：仅保存在当前设备本地
- 不需要登录
- 不需要服务器
- 不需要 iCloud
- 不需要联网

建议最低支持 iOS 17。

---

## 3. 核心功能

### 3.1 房间管理

支持：

- 添加房间
- 修改房间名称
- 删除房间
- 调整房间显示顺序

房间数据字段：

```text
Room
- id: UUID
- name: String
- sortOrder: Int
```

---

### 3.2 房态日历

首页直接显示房态日历。

布局：

- 纵向：房间
- 横向：日期
- 左侧固定房间名称
- 顶部固定日期
- 日期区域可以左右滑动
- 房间区域可以上下滑动
- 默认定位到今天

示意：

```text
        8/14      8/15      8/16      8/17      8/18

101     空        张三       张三       张三       空
102     李四      李四       空         空         空
103     空        空         空         王五       王五
```

实际 UI 中，同一位客人的连续住宿日期应尽量显示成一整条连续状态条。

例如：

```text
101    [ 张三 · 入住中 ---------------- ]
102    [ 李四 · 预定中 --- ]    空
103     空       空       [ 王五 · 入住中 --- ]
```

这样可以直接看出客人住多久。

---

## 4. 房间状态

只保留三种状态：

### 空置中

表示当前日期没有任何住宿记录。

不需要在数据库中保存“空置”记录。

只要某个房间当天没有预定或入住记录，就自动显示为空置。

建议显示：

```text
空
```

颜色：

- 白色
- 或浅灰色

---

### 预定中

表示客人已经预定，但还没有入住。

建议颜色：

- 橙色

显示内容：

```text
张三
预
```

或者：

```text
张三 · 预定
```

---

### 入住中

表示客人已经入住。

建议颜色：

- 蓝色

显示内容：

```text
张三
住
```

或者：

```text
张三 · 入住
```

颜色只作为辅助，必须同时显示文字状态。

---

## 5. 新增住宿记录

用户点击某个房间的空白日期后，弹出编辑页面。

填写内容：

- 客人姓名
- 房间
- 入住日期
- 退房日期
- 状态
  - 预定中
  - 入住中

例如：

```text
客人姓名：张三
房间：203
入住日期：2026-08-15
退房日期：2026-08-18
状态：预定中
```

保存后：

```text
203 房
8/15 - 8/17
张三 · 预定中
```

不需要手工分别修改每天的状态。

---

## 6. 修改住宿记录

点击已有住宿状态条，打开编辑页面。

支持修改：

- 客人姓名
- 房间
- 入住日期
- 退房日期
- 状态

常用操作：

### 办理入住

```text
预定中 → 入住中
```

日期保持不变。

### 提前退房

直接修改退房日期。

例如原来：

```text
8/15 入住
8/20 退房
```

客人在 8/18 提前退房：

```text
退房日期改为 8/18
```

那么：

```text
8/18 之后自动恢复为空置
```

### 删除住宿记录

删除后，对应日期自动恢复为空置。

删除前需要二次确认。

---

## 7. 日期规则

统一采用：

```text
入住日期 <= 占用日期 < 退房日期
```

例如：

```text
入住日期：8/14
退房日期：8/17
```

实际占用：

```text
8/14
8/15
8/16
```

共 3 晚。

8/17 可以安排新的客人。

---

## 8. 防止重复订房

同一个房间在同一个日期不能出现两条住宿记录。

例如已经存在：

```text
203 房
张三
8/15 - 8/18
```

如果再次添加：

```text
203 房
李四
8/17 - 8/20
```

系统必须禁止保存。

提示：

```text
该房间在所选日期已有客人，请修改房间或日期。
```

日期冲突判断：

```text
newCheckIn < oldCheckOut
AND
newCheckOut > oldCheckIn
```

满足以上条件即为冲突。

---

## 9. 数据模型

第一版只需要两个核心数据模型。

### Room

```swift
@Model
final class Room {
    var id: UUID
    var name: String
    var sortOrder: Int

    init(
        id: UUID = UUID(),
        name: String,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.name = name
        self.sortOrder = sortOrder
    }
}
```

---

### StayRecord

```swift
enum StayStatus: String, Codable {
    case reserved
    case checkedIn
}
```

```swift
@Model
final class StayRecord {
    var id: UUID
    var roomId: UUID
    var guestName: String
    var checkInDate: Date
    var checkOutDate: Date
    var statusRawValue: String

    var status: StayStatus {
        get {
            StayStatus(rawValue: statusRawValue) ?? .reserved
        }
        set {
            statusRawValue = newValue.rawValue
        }
    }

    init(
        id: UUID = UUID(),
        roomId: UUID,
        guestName: String,
        checkInDate: Date,
        checkOutDate: Date,
        status: StayStatus
    ) {
        self.id = id
        self.roomId = roomId
        self.guestName = guestName
        self.checkInDate = checkInDate
        self.checkOutDate = checkOutDate
        self.statusRawValue = status.rawValue
    }
}
```

---

## 10. 页面结构

整个 App 尽量控制在 3 个主要页面以内。

### 10.1 房态首页

文件建议：

```text
OccupancyCalendarView.swift
```

负责：

- 显示所有房间
- 显示日期
- 显示空置状态
- 显示预定状态
- 显示入住状态
- 点击空白日期新增住宿
- 点击住宿状态条编辑
- 快速回到今天

这是整个 App 最重要的页面。

---

### 10.2 住宿编辑弹窗

文件建议：

```text
StayEditorSheet.swift
```

负责：

- 新增住宿
- 修改住宿
- 修改姓名
- 修改日期
- 修改状态
- 删除住宿
- 冲突检查

尽量使用 SwiftUI Sheet，不需要进入复杂的多层页面。

---

### 10.3 房间管理

文件建议：

```text
RoomManagerView.swift
```

负责：

- 添加房间
- 修改房间名称
- 删除房间
- 调整房间顺序

---

## 11. 推荐代码结构

```text
HomestayManager/
├── HomestayManagerApp.swift
│
├── Models/
│   ├── Room.swift
│   ├── StayRecord.swift
│   └── StayStatus.swift
│
├── Views/
│   ├── OccupancyCalendarView.swift
│   ├── RoomRowView.swift
│   ├── StayBarView.swift
│   ├── StayEditorSheet.swift
│   └── RoomManagerView.swift
│
├── ViewModels/
│   └── OccupancyViewModel.swift
│
└── Services/
    └── ConflictChecker.swift
```

不要为了架构而增加过多文件。

如果某些功能很简单，可以直接写在对应 View 或 ViewModel 中。

---

## 12. 首页 UI 原则

UI 必须以“快速看房态”为第一目标。

### 顶部

```text
房态                 今天    +
```

其中：

- “今天”：快速回到今天
- “+”：添加住宿或房间

---

### 房态区域

左边固定房间：

```text
101
102
103
201
202
```

顶部固定日期：

```text
8/14
8/15
8/16
8/17
8/18
```

状态建议：

```text
空置    白色 / 浅灰
预定    橙色
入住    蓝色
```

住宿状态条内部优先显示客人姓名。

---

## 13. 本地数据保存

所有数据仅保存在当前 iPhone。

使用：

```text
SwiftData
```

不需要：

```text
网络请求
API
服务器
用户账号
密码
CloudKit
iCloud 同步
Firebase
数据库服务器
```

App 关闭或手机重启后，数据仍然保留。

删除 App 后，本地数据可以一起删除。

第一版无需考虑跨设备同步。

---

## 14. MVP 验收标准

开发完成后，需要满足以下条件：

- [ ] 可以添加房间
- [ ] 可以删除房间
- [ ] 可以修改房间名称
- [ ] 可以调整房间顺序
- [ ] 首页可以看到所有房间
- [ ] 首页可以看到今天和未来日期
- [ ] 日期可以左右滑动
- [ ] 房间可以上下滑动
- [ ] 可以新增客人
- [ ] 可以填写入住日期
- [ ] 可以填写退房日期
- [ ] 可以设置预定状态
- [ ] 可以设置入住状态
- [ ] 可以修改已有住宿记录
- [ ] 可以删除住宿记录
- [ ] 可以将预定改为入住
- [ ] 可以修改退房日期
- [ ] 修改后空余日期自动恢复为空置
- [ ] 同一房间不能出现日期重叠
- [ ] 客人姓名可以直接在房态表中看到
- [ ] 连续住宿时间可以一眼看出
- [ ] App 关闭后数据不会丢失
- [ ] 整个 App 不需要联网

---

## 15. 第一版明确不做

为了保持 App 足够简单，第一版明确不开发：

- 用户注册
- 用户登录
- 多用户
- 员工权限
- 后台管理系统
- Web 版本
- Android 版本
- iCloud
- 云同步
- 网络服务器
- 在线数据库
- 短信
- 微信通知
- 财务统计
- 房费统计
- 支付功能
- OTA 平台同步
- 携程同步
- 美团同步
- Booking 同步
- Airbnb 同步
- 客户会员系统
- 营销功能
- 复杂报表

后续只有确实产生需求时再添加。

---

## 16. 开发顺序

建议按照以下顺序开发：

### 第一步

完成：

```text
Room
StayRecord
StayStatus
SwiftData
```

先确保数据可以正常添加、修改、删除和保存。

### 第二步

完成房间管理。

### 第三步

完成房态日历基本界面。

先不用追求非常漂亮，只要能正确显示：

```text
房间 × 日期 × 状态
```

### 第四步

完成住宿新增和编辑。

### 第五步

加入日期冲突检查。

### 第六步

优化连续住宿状态条。

让同一条住宿记录在日期表上视觉上连成一整段。

### 第七步

优化 iPhone 操作体验和 UI。

---

## 17. 最终产品原则

这不是一个完整酒店 PMS。

它只是一个非常简单、专门解决民宿房态管理问题的工具。

设计任何新功能之前，都先判断：

> 这个功能能不能让我更快知道哪个房间有人、谁在住、住多久、什么时候还有空房？

如果不能，就不应该放进第一版。

第一版应该做到：

```text
简单
快速
清楚
稳定
本地
无需联网
```
