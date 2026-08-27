# HomestayManager APP

一个面向手机的本地离线民宿房态管理 PWA，用房间 × 日期日历替代 Excel 色块。

## 已实现功能

- 房间添加、改名、删除和排序
- 30 天房态日历与前后周切换
- 新增、编辑和删除住宿记录
- 预定中 / 入住中两种状态
- 连续住宿状态条与住宿晚数
- 同一房间日期冲突检查
- 浏览器本地持久化，无账号、服务器和联网依赖
- JSON 数据导出与恢复
- Android / iPhone 添加到主屏幕及离线缓存

## 在线地址

<https://suihan-shu.github.io/HomestayManager-PWA/>

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

打开终端显示的本地地址即可使用。生产构建：

```bash
npm run build
```

## 安装到手机

1. 使用手机浏览器打开在线地址。
2. Android 打开浏览器菜单；iPhone 点击 Safari 的“分享”。
3. 选择“添加到主屏幕”或“安装应用”。
4. 按页面提示确认安装。

数据只保存在当前设备浏览器中。建议定期在 App 的“数据备份”中导出 JSON 文件。
