"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Room = { id: string; name: string; sortOrder: number };
type StayStatus = "reserved" | "checkedIn";
type StayRecord = {
  id: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: StayStatus;
};

type StayDraft = Omit<StayRecord, "id"> & { id?: string };
type SheetName = "actions" | "rooms" | "stay" | "backup" | "install" | null;

const STORAGE_KEY = "homestay-manager-data-v1";
const VISIBLE_DAYS = 30;

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return localDateKey(new Date());
}

function parseDate(key: string) {
  return new Date(`${key}T00:00:00`);
}

function addDays(key: string, amount: number) {
  const date = parseDate(key);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function dayDiff(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function stayOverlaps(a: StayDraft, b: StayRecord) {
  return a.roomId === b.roomId && a.checkInDate < b.checkOutDate && a.checkOutDate > b.checkInDate;
}

function formatShortDate(key: string) {
  const date = parseDate(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-grabber" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="close-button" type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [visibleStart, setVisibleStart] = useState("");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [stayDraft, setStayDraft] = useState<StayDraft | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => a.sortOrder - b.sortOrder), [rooms]);
  const visibleDates = useMemo(() => visibleStart ? Array.from({ length: VISIBLE_DAYS }, (_, index) => addDays(visibleStart, index)) : [], [visibleStart]);
  const rangeEnd = visibleStart ? addDays(visibleStart, VISIBLE_DAYS) : "";

  useEffect(() => {
    setVisibleStart(todayKey());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as { rooms?: Room[]; stays?: StayRecord[] };
        if (Array.isArray(data.rooms) && Array.isArray(data.stays)) {
          setRooms(data.rooms);
          setStays(data.stays);
        }
      }
    } catch {
      setToast("本地数据读取失败，请从备份恢复");
    } finally {
      setReady(true);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, rooms, stays }));
  }, [ready, rooms, stays]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openNewStay(roomId?: string, date = todayKey()) {
    if (!rooms.length) {
      setSheet("rooms");
      setToast("请先添加房间");
      return;
    }
    setFormError("");
    setStayDraft({
      roomId: roomId ?? sortedRooms[0].id,
      guestName: "",
      checkInDate: date,
      checkOutDate: addDays(date, 1),
      status: "reserved",
    });
    setSheet("stay");
  }

  function openExistingStay(stay: StayRecord) {
    setFormError("");
    setStayDraft({ ...stay });
    setSheet("stay");
  }

  function saveStay(event: FormEvent) {
    event.preventDefault();
    if (!stayDraft) return;
    const cleaned = { ...stayDraft, guestName: stayDraft.guestName.trim() };
    if (!cleaned.guestName) {
      setFormError("请输入客人姓名");
      return;
    }
    if (cleaned.checkOutDate <= cleaned.checkInDate) {
      setFormError("退房日期必须晚于入住日期");
      return;
    }
    const conflicting = stays.find((stay) => stay.id !== cleaned.id && stayOverlaps(cleaned, stay));
    if (conflicting) {
      setFormError("该房间在所选日期已有客人，请修改房间或日期。");
      return;
    }

    if (cleaned.id) {
      setStays((current) => current.map((stay) => stay.id === cleaned.id ? cleaned as StayRecord : stay));
      setToast("住宿记录已更新");
    } else {
      setStays((current) => [...current, { ...cleaned, id: makeId() }]);
      setToast("住宿记录已添加");
    }
    setSheet(null);
    setStayDraft(null);
  }

  function deleteStay() {
    if (!stayDraft?.id || !window.confirm("确定删除这条住宿记录吗？删除后对应日期将恢复为空置。")) return;
    setStays((current) => current.filter((stay) => stay.id !== stayDraft.id));
    setSheet(null);
    setStayDraft(null);
    setToast("住宿记录已删除");
  }

  function addRoom(event: FormEvent) {
    event.preventDefault();
    const name = newRoomName.trim();
    if (!name) return;
    if (rooms.some((room) => room.name === name)) {
      setToast("已有同名房间");
      return;
    }
    setRooms((current) => [...current, { id: makeId(), name, sortOrder: current.length }]);
    setNewRoomName("");
    setToast(`已添加 ${name}`);
  }

  function renameRoom(id: string, name: string) {
    setRooms((current) => current.map((room) => room.id === id ? { ...room, name } : room));
  }

  function normalizeRoomName(id: string) {
    setRooms((current) => current.map((room) => room.id === id ? { ...room, name: room.name.trim() || "未命名房间" } : room));
  }

  function moveRoom(id: string, direction: -1 | 1) {
    const ordered = [...sortedRooms];
    const index = ordered.findIndex((room) => room.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setRooms(ordered.map((room, sortOrder) => ({ ...room, sortOrder })));
  }

  function deleteRoom(room: Room) {
    const related = stays.filter((stay) => stay.roomId === room.id).length;
    const message = related
      ? `“${room.name}”有 ${related} 条住宿记录，删除房间会一并删除这些记录。确定继续吗？`
      : `确定删除“${room.name}”吗？`;
    if (!window.confirm(message)) return;
    const remaining = sortedRooms.filter((item) => item.id !== room.id).map((item, sortOrder) => ({ ...item, sortOrder }));
    setRooms(remaining);
    setStays((current) => current.filter((stay) => stay.roomId !== room.id));
    setToast("房间已删除");
  }

  function goToToday() {
    setVisibleStart(todayKey());
    requestAnimationFrame(() => { if (calendarRef.current) calendarRef.current.scrollLeft = 0; });
  }

  function exportData() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rooms, stays }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `房态备份-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("备份文件已导出");
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { rooms?: Room[]; stays?: StayRecord[] };
      if (!Array.isArray(data.rooms) || !Array.isArray(data.stays)) throw new Error();
      const validRooms = data.rooms.every((room) => typeof room.id === "string" && typeof room.name === "string" && typeof room.sortOrder === "number");
      const validStays = data.stays.every((stay) =>
        typeof stay.id === "string" && typeof stay.roomId === "string" && typeof stay.guestName === "string" &&
        typeof stay.checkInDate === "string" && typeof stay.checkOutDate === "string" &&
        (stay.status === "reserved" || stay.status === "checkedIn")
      );
      if (!validRooms || !validStays) throw new Error();
      if (!window.confirm("导入会覆盖当前全部房间和住宿记录，确定继续吗？")) return;
      setRooms(data.rooms);
      setStays(data.stays);
      setSheet(null);
      setToast("备份已恢复");
    } catch {
      setToast("备份文件格式不正确");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HOMESTAY MANAGER</p>
          <h1>房态</h1>
          <p className="date-caption">{ready && visibleStart ? parseDate(visibleStart).toLocaleDateString("zh-CN", { year: "numeric", month: "long" }) : "房态日历"}</p>
        </div>
        <div className="topbar-actions">
          <button className="text-button" type="button" onClick={goToToday}>今天</button>
          <button className="icon-button" type="button" onClick={() => setSheet("actions")} aria-label="打开操作菜单">＋</button>
        </div>
      </header>

      <nav className="date-navigation" aria-label="日期导航">
        <button type="button" disabled={!ready || !visibleStart} onClick={() => setVisibleStart((date) => addDays(date, -7))} aria-label="前一周">‹</button>
        <span>{ready && visibleStart ? `${formatShortDate(visibleStart)} — ${formatShortDate(addDays(visibleStart, VISIBLE_DAYS - 1))}` : "正在准备日历"}</span>
        <button type="button" disabled={!ready || !visibleStart} onClick={() => setVisibleStart((date) => addDays(date, 7))} aria-label="后一周">›</button>
      </nav>

      <section className="calendar-card" aria-label="房态日历">
        {ready && sortedRooms.length === 0 ? (
          <div className="empty-calendar">
            <div className="empty-preview" aria-hidden="true">
              <span>房间</span><i /><i /><i />
              <b>101</b><em /><em /><em />
              <b>102</b><em /><em className="preview-reserved" /><em className="preview-reserved" />
              <b>103</b><em className="preview-occupied" /><em className="preview-occupied" /><em />
            </div>
            <h2>先添加你的第一个房间</h2>
            <p>添加后，就能按日期查看预定、入住和空置情况。</p>
            <button className="primary-button" type="button" onClick={() => setSheet("rooms")}>添加房间</button>
          </div>
        ) : (
          <div className="calendar-scroll" ref={calendarRef}>
            <div className="calendar-header calendar-grid-width">
              <div className="corner-cell">房间</div>
              <div className="date-track">
                {visibleDates.map((date) => {
                  const parsed = parseDate(date);
                  const isToday = date === todayKey();
                  return (
                    <div className={`date-cell ${isToday ? "is-today" : ""}`} key={date}>
                      <strong>{parsed.toLocaleDateString("zh-CN", { weekday: "short" })}</strong>
                      <span>{parsed.getMonth() + 1}/{parsed.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {sortedRooms.map((room) => {
              const roomStays = stays.filter((stay) => stay.roomId === room.id && stay.checkInDate < rangeEnd && stay.checkOutDate > visibleStart);
              return (
                <div className="calendar-row calendar-grid-width" key={room.id}>
                  <button className="room-label" type="button" onClick={() => setSheet("rooms")}>{room.name}</button>
                  <div className="room-track">
                    {visibleDates.map((date, index) => {
                      const occupied = stays.some((stay) => stay.roomId === room.id && stay.checkInDate <= date && stay.checkOutDate > date);
                      return (
                        <button
                          className={`vacant-cell ${date === todayKey() ? "today-column" : ""}`}
                          style={{ gridColumn: index + 1, gridRow: 1 }}
                          key={date}
                          type="button"
                          disabled={occupied}
                          tabIndex={occupied ? -1 : 0}
                          onClick={() => openNewStay(room.id, date)}
                          aria-label={`${room.name} ${date} 空置，添加住宿`}
                        >
                          {!occupied && <span>空</span>}
                        </button>
                      );
                    })}

                    {roomStays.map((stay) => {
                      const clippedStart = stay.checkInDate < visibleStart ? visibleStart : stay.checkInDate;
                      const clippedEnd = stay.checkOutDate > rangeEnd ? rangeEnd : stay.checkOutDate;
                      const start = dayDiff(visibleStart, clippedStart) + 1;
                      const span = Math.max(1, dayDiff(clippedStart, clippedEnd));
                      return (
                        <button
                          className={`stay-bar ${stay.status}`}
                          style={{ gridColumn: `${start} / span ${span}`, gridRow: 1 }}
                          type="button"
                          key={stay.id}
                          onClick={() => openExistingStay(stay)}
                          aria-label={`${room.name}，${stay.guestName}，${stay.status === "reserved" ? "预定中" : "入住中"}，${stay.checkInDate}至${stay.checkOutDate}`}
                        >
                          <strong>{stay.guestName}</strong>
                          <span>{stay.status === "reserved" ? "预定" : "入住"} · {dayDiff(stay.checkInDate, stay.checkOutDate)}晚</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="bottom-bar">
        <div className="legend" aria-label="房态说明">
          <span><i className="legend-dot vacant" />空置</span>
          <span><i className="legend-dot reserved" />预定</span>
          <span><i className="legend-dot occupied" />入住</span>
        </div>
        <button className="manage-link" type="button" onClick={() => setSheet("rooms")}>管理房间</button>
      </footer>

      {sheet === "actions" && (
        <Sheet title="添加与管理" onClose={() => setSheet(null)}>
          <div className="action-list">
            <button type="button" onClick={() => openNewStay()}><i className="action-icon orange">客</i><span><strong>添加住宿</strong><small>新增预定或办理入住</small></span><b>›</b></button>
            <button type="button" onClick={() => setSheet("rooms")}><i className="action-icon green">房</i><span><strong>管理房间</strong><small>添加、改名、排序或删除</small></span><b>›</b></button>
            <button type="button" onClick={() => setSheet("backup")}><i className="action-icon blue">备</i><span><strong>数据备份</strong><small>导出或恢复本机数据</small></span><b>›</b></button>
            <button type="button" onClick={() => setSheet("install")}><i className="action-icon gray">装</i><span><strong>安装到主屏幕</strong><small>像普通 App 一样打开</small></span><b>›</b></button>
          </div>
        </Sheet>
      )}

      {sheet === "rooms" && (
        <Sheet title="房间管理" onClose={() => setSheet(null)} wide>
          <form className="add-room-form" onSubmit={addRoom}>
            <label>
              <span className="sr-only">新房间名称</span>
              <input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="例如：101、海景房" maxLength={20} />
            </label>
            <button type="submit" disabled={!newRoomName.trim()}>添加</button>
          </form>
          {sortedRooms.length ? (
            <div className="room-list">
              {sortedRooms.map((room, index) => (
                <div className="room-item" key={room.id}>
                  <span className="drag-mark">≡</span>
                  <input aria-label="房间名称" value={room.name} maxLength={20} onChange={(event) => renameRoom(room.id, event.target.value)} onBlur={() => normalizeRoomName(room.id)} />
                  <div className="room-controls">
                    <button type="button" disabled={index === 0} onClick={() => moveRoom(room.id, -1)} aria-label={`${room.name}上移`}>↑</button>
                    <button type="button" disabled={index === sortedRooms.length - 1} onClick={() => moveRoom(room.id, 1)} aria-label={`${room.name}下移`}>↓</button>
                    <button className="danger-icon" type="button" onClick={() => deleteRoom(room)} aria-label={`删除${room.name}`}>×</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="sheet-empty">还没有房间，先在上方添加一个。</p>}
        </Sheet>
      )}

      {sheet === "stay" && stayDraft && (
        <Sheet title={stayDraft.id ? "编辑住宿" : "新增住宿"} onClose={() => { setSheet(null); setStayDraft(null); }} wide>
          <form className="stay-form" onSubmit={saveStay}>
            <label className="field full-field">
              <span>客人姓名</span>
              <input autoFocus value={stayDraft.guestName} onChange={(event) => setStayDraft({ ...stayDraft, guestName: event.target.value })} placeholder="请输入姓名" maxLength={30} />
            </label>
            <label className="field full-field">
              <span>房间</span>
              <select value={stayDraft.roomId} onChange={(event) => setStayDraft({ ...stayDraft, roomId: event.target.value })}>
                {sortedRooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}
              </select>
            </label>
            <div className="form-columns">
              <label className="field"><span>入住日期</span><input type="date" value={stayDraft.checkInDate} onChange={(event) => setStayDraft({ ...stayDraft, checkInDate: event.target.value })} /></label>
              <label className="field"><span>退房日期</span><input type="date" value={stayDraft.checkOutDate} min={addDays(stayDraft.checkInDate, 1)} onChange={(event) => setStayDraft({ ...stayDraft, checkOutDate: event.target.value })} /></label>
            </div>
            <fieldset className="status-picker">
              <legend>状态</legend>
              <label className={stayDraft.status === "reserved" ? "selected reserved-option" : ""}>
                <input type="radio" name="status" value="reserved" checked={stayDraft.status === "reserved"} onChange={() => setStayDraft({ ...stayDraft, status: "reserved" })} />
                <i /> <span><strong>预定中</strong><small>客人还未入住</small></span>
              </label>
              <label className={stayDraft.status === "checkedIn" ? "selected checked-option" : ""}>
                <input type="radio" name="status" value="checkedIn" checked={stayDraft.status === "checkedIn"} onChange={() => setStayDraft({ ...stayDraft, status: "checkedIn" })} />
                <i /> <span><strong>入住中</strong><small>客人已经入住</small></span>
              </label>
            </fieldset>
            <div className="stay-summary">
              <span>住宿天数</span>
              <strong>{Math.max(0, dayDiff(stayDraft.checkInDate, stayDraft.checkOutDate))} 晚</strong>
              <small>{formatShortDate(stayDraft.checkInDate)} 入住 · {formatShortDate(stayDraft.checkOutDate)} 退房</small>
            </div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="save-button" type="submit">保存</button>
            {stayDraft.id && <button className="delete-button" type="button" onClick={deleteStay}>删除住宿记录</button>}
          </form>
        </Sheet>
      )}

      {sheet === "backup" && (
        <Sheet title="数据备份" onClose={() => setSheet(null)}>
          <div className="backup-panel">
            <p>所有数据只保存在这台设备。建议定期导出备份文件，并保存到“文件”App。</p>
            <button className="backup-button primary" type="button" onClick={exportData}><strong>导出备份</strong><span>保存当前全部房间和住宿记录</span></button>
            <button className="backup-button" type="button" onClick={() => importRef.current?.click()}><strong>恢复备份</strong><span>选择以前导出的 JSON 文件</span></button>
            <input ref={importRef} className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); }} />
            <div className="backup-stats"><span>{rooms.length} 个房间</span><span>{stays.length} 条住宿</span></div>
          </div>
        </Sheet>
      )}

      {sheet === "install" && (
        <Sheet title="安装到手机" onClose={() => setSheet(null)}>
          <ol className="install-steps">
            <li><b>1</b><span>使用手机浏览器打开这个页面</span></li>
            <li><b>2</b><span>Android 点击浏览器菜单，iPhone 点击 Safari 的<strong>分享</strong></span></li>
            <li><b>3</b><span>选择 <strong>“添加到主屏幕”</strong>或<strong>“安装应用”</strong></span></li>
            <li><b>4</b><span>按页面提示确认安装</span></li>
          </ol>
          <p className="install-note">安装后可从主屏幕直接打开。首次打开并加载完成后，没有网络也能继续使用。</p>
        </Sheet>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
