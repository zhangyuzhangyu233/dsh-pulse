/**
 * Pulse - a Claude-inspired live status layer for the Harness sidebar.
 *
 * Sits above the workspace list and summarises sessions by run state
 * (Needs input / Working / Completed) across every workspace. Each state row is
 * expandable to the concrete session list, and clicking a session opens it.
 *
 * The workspace tree itself stays exactly as shipped. Metrics are copied from
 * the native sidebar CSS (14px text, 36px section header, 32px rows, 4px header
 * padding) so the table lines up with the "工作区" heading.
 */
window.__ModuleLoader__.load({
  id: 'dsh-pulse',
  factory(require) {
    const React = require('react');

    const STRIP_ID = 'pulse-status-strip';
    const STYLE_ID = 'pulse-status-strip-style';
    const PREF_KEY = 'dsh.pulse.enabled';
    const EXPAND_KEY = 'dsh.pulse.expanded';
    const COLLAPSE_KEY = 'dsh.pulse.collapsed';
    const NOTIFY_KEY = 'dsh.pulse.notify';

    const STRINGS = {
      zh: {
        title: '状态',
        blocked: '需要输入',
        review: '待审查',
        working: '正在工作',
        completed: '已完成',
        untitled: '未命名会话',
        ungrouped: '未分组',
        expand: '展开列表',
        collapse: '收起列表',
        expandAll: '展开状态列表',
        collapseAll: '折叠状态列表',
        emptyGroup: '没有会话',
        justCompleted: '未读',
        notifyTitle: '状态摘要',
        notifyBlocked: '需要操作',
        notifyWorking: '正在运行',
        notifyCompleted: '刚刚完成',
        notifyMore: '还有 {n} 个',
        notifyClose: '关闭通知',
        notifySettings: '状态摘要通知',
        notifySettingsHint: '会话开始运行、等待操作或刚完成时，弹出摘要通知',
        simSettings: '模拟状态数据（演示）',
        simSettingsHint: '用脚本数据循环演示：分组展开、运行中转圈与执行步骤、未读状态',
        settingsTitle: 'Pulse 状态表',
        settingsHint: '在工作区列表上方显示：需要输入 / 待审查 / 正在工作 / 已完成，可展开会话列表',
      },
      en: {
        title: 'Status',
        blocked: 'Needs input',
        review: 'Ready for review',
        working: 'Working',
        completed: 'Completed',
        untitled: 'Untitled session',
        ungrouped: 'Ungrouped',
        expand: 'Expand list',
        collapse: 'Collapse list',
        expandAll: 'Expand status list',
        collapseAll: 'Collapse status list',
        emptyGroup: 'No sessions',
        justCompleted: 'Unread',
        notifyTitle: 'Status summary',
        notifyBlocked: 'Needs input',
        notifyWorking: 'Working',
        notifyCompleted: 'Just finished',
        notifyMore: '{n} more',
        notifyClose: 'Dismiss notification',
        notifySettings: 'Status notifications',
        notifySettingsHint: 'A summary pops up when a session starts, needs input, or finishes',
        simSettings: 'Simulate status data (demo)',
        simSettingsHint: 'Loops scripted data: grouped expansion, running spinner and steps, unread state',
        settingsTitle: 'Pulse status table',
        settingsHint: 'Needs input / Ready for review / Working / Completed above the workspace list; each row expands to its sessions',
      },
    };

    let lang = 'zh';
    const langListeners = new Set();
    function useLang() {
      return React.useSyncExternalStore(
        (cb) => { langListeners.add(cb); return () => langListeners.delete(cb); },
        () => lang,
        () => 'zh',
      );
    }
    function strings() { return STRINGS[lang] || STRINGS.zh; }

    function langOf(snapshot) {
      const active = snapshot && snapshot.active;
      const id = typeof active === 'string' ? active : (active && (active.id || active.locale || active.language)) || '';
      return String(id).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    }

    // ------------------------------------------------------------- preferences
    const prefListeners = new Set();
    let enabled = readBool(PREF_KEY, true);
    function readBool(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        return raw === '1';
      } catch (error) { return fallback; }
    }
    function writeBool(key, value) {
      try { window.localStorage.setItem(key, value ? '1' : '0'); } catch (error) { }
    }

    let collapsed = readBool(COLLAPSE_KEY, false);

    const PROJECTS_KEY = 'dsh.pulse.collapsed-projects';
    let collapsedProjects = readCollapsedProjects();
    function readCollapsedProjects() {
      try {
        const raw = window.localStorage.getItem(PROJECTS_KEY);
        if (raw === null) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch (error) { return new Set(); }
    }
    function saveCollapsedProjects() {
      try {
        window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(Array.from(collapsedProjects)));
      } catch (error) { }
    }

    // Runtime error channel: a crashing slot entry is deactivated by the slot
    // runtime, so failures must be caught locally and surfaced in Settings.
    let lastError = '';
    const errorListeners = new Set();
    function setLastError(value) {
      lastError = value;
      errorListeners.forEach((fn) => fn());
    }
    function useLastError() {
      return React.useSyncExternalStore(
        (cb) => { errorListeners.add(cb); return () => errorListeners.delete(cb); },
        () => lastError,
        () => '',
      );
    }
    function reportError(error) {
      const text = String((error && error.stack) || error || 'unknown error');
      setLastError(text.slice(0, 600));
      try { console.error('[dsh-pulse]', error); } catch (e) { }
    }

    let expanded = readExpanded();
    function readExpanded() {
      try {
        const raw = window.localStorage.getItem(EXPAND_KEY);
        if (raw === null) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch (error) { return new Set(); }
    }
    function saveExpanded() {
      try { window.localStorage.setItem(EXPAND_KEY, JSON.stringify(Array.from(expanded))); } catch (error) { }
    }

    function useEnabled() {
      return React.useSyncExternalStore(
        (cb) => { prefListeners.add(cb); return () => prefListeners.delete(cb); },
        () => enabled,
        () => true,
      );
    }
    function setEnabled(next) {
      enabled = !!next;
      writeBool(PREF_KEY, enabled);
      prefListeners.forEach((fn) => fn());
      if (!enabled) {
        const strip = document.getElementById(STRIP_ID);
        if (strip) strip.remove();
      } else {
        renderStrip();
      }
    }

    // ------------------------------------------------------- simulation mode
    /*
     * A scripted demo of the whole flow (grouping, expansion, running spinner
     * + steps, unread, notifications) that needs no real sessions: useful for
     * checking the interaction end to end.
     */
    const SIM_KEY = 'dsh.pulse.simulate';
    let simulate = readBool(SIM_KEY, false);
    let isSimulating = false;
    const simListeners = new Set();
    function useSimulate() {
      return React.useSyncExternalStore(
        (cb) => { simListeners.add(cb); return () => simListeners.delete(cb); },
        () => simulate,
        () => false,
      );
    }
    function setSimulate(next) {
      simulate = !!next;
      isSimulating = simulate;
      writeBool(SIM_KEY, simulate);
      simListeners.forEach((fn) => fn());
    }

    let simPhase = 0;
    function mockSnapshot() {
      const now = Date.now();
      const make = (id, title, steps, unread) => ({
        id,
        title,
        unread: !!unread,
        updatedAt: now,
        steps: steps === undefined ? null : steps,
      });
      const base = {
        blocked: [], review: [], working: [], completed: [],
      };
      if (simPhase === 0) {
        base.blocked.push(make('sim-blocked-1', '修复登录回调超时'));
        for (let i = 0; i < 14; i += 1) base.completed.push(make('sim-done-' + i, '已完成会话 ' + (i + 1)));
      } else if (simPhase === 1) {
        base.working.push(make('sim-work-1', '运行时飞行代码穿梭动效', ['读取 shader 编译日志', '重写粒子发射器']));
        base.working.push(make('sim-work-2', '蔡徐坤篮球字符动画讨论', ['整理分镜脚本']));
        for (let i = 0; i < 14; i += 1) base.completed.push(make('sim-done-' + i, '已完成会话 ' + (i + 1)));
      } else if (simPhase === 2) {
        base.working.push(make('sim-work-1', '运行时飞行代码穿梭动效', ['重写粒子发射器', '播放合成音轨']));
        base.blocked.push(make('sim-blocked-2', '等待确认计划：侧栏重构'));
        for (let i = 0; i < 13; i += 1) base.completed.push(make('sim-done-' + i, '已完成会话 ' + (i + 1)));
        base.completed.push(make('sim-done-new', '蔡徐坤篮球字符动画讨论', null, true));
      } else if (simPhase === 3) {
        base.review.push(make('sim-review-1', '重构 Pulse 状态表'));
        for (let i = 0; i < 20; i += 1) base.completed.push(make('sim-done-' + i, '已完成会话 ' + (i + 1), null, i < 3));
      } else {
        base.blocked.push(make('sim-blocked-3', '需要批准：写入工作区设置'));
        base.working.push(make('sim-work-3', 'Particle shader 调参', ['调整扰动幅度']));
        for (let i = 0; i < 16; i += 1) base.completed.push(make('sim-done-' + i, '已完成会话 ' + (i + 1)));
      }

      // Demo data also carries project captions so the caption row is visible.
      const projectNames = ['dsh-pulse', 'CHNMedical', 'Ur-Style_DeepSeek_Ver'];
      let projectSeq = 0;
      for (const key of GROUPS) {
        for (const entry of base[key]) {
          entry.project = projectNames[projectSeq % projectNames.length];
          projectSeq += 1;
        }
      }

      const counts = { blocked: 0, review: 0, working: 0, completed: 0, justCompleted: 0 };
      const groups = { blocked: [], review: [], working: [], completed: [] };
      const states = new Map();
      for (const key of GROUPS) {
        counts[key] = base[key].length;
        groups[key] = base[key];
        for (const entry of base[key]) states.set(entry.id, { bucket: key, title: entry.title, unread: entry.unread });
      }
      for (const entry of groups.completed) if (entry.unread) counts.justCompleted += 1;
      return { counts, groups, states, needProjection: [] };
    }

    // ------------------------------------------------------------ data model
    /*
     * Claude's sidebar row kinds, in its own order:
     * blocked (Needs input) → review (Ready for review) → working → completed.
     * `review` has no Harness data source yet; the bucket exists so a future
     * status field lights it up, and the row stays hidden while it is empty.
     */
    function bucketOf(status, session) {
      const kind = status && status.pendingInteraction && status.pendingInteraction.kind;
      if (kind === 'approval' || kind === 'plan-review' || kind === 'question') return 'blocked';
      if (status && (status.reviewReady === true || status.readyForReview === true)) return 'review';
      if ((status && status.running === true) || (session && session.running === true)) return 'working';
      return 'completed';
    }

    const GROUPS = ['blocked', 'review', 'working', 'completed'];
    let last = {
      counts: { blocked: 0, review: 0, working: 0, completed: 0, justCompleted: 0 },
      groups: { blocked: [], review: [], working: [], completed: [] },
    };

    function displayTitle(session, blankLabel) {
      if (!session) return blankLabel;
      if (session.displayTitle) return session.displayTitle;
      if (session.title) return session.title;
      return blankLabel;
    }

    /*
     * Sessions do not carry a workspace id, but the Workspace snapshot owns the
     * grouping (WorkspaceView.sessionIds). Resolve session → project name from
     * it, tolerating the snapshot's store / array shapes.
     */
    function workspaceEntries(snapshot) {
      const raw = [];
      const pushList = (value) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) { for (const item of value) raw.push(item); return; }
        if (typeof value.getSnapshot === 'function') { pushList(value.getSnapshot()); return; }
        if (Array.isArray(value.items)) { for (const item of value.items) raw.push(item); return; }
        if (Array.isArray(value.workspaceIds) && value.byId) {
          for (const id of value.workspaceIds) if (value.byId[id]) raw.push(value.byId[id]);
        }
      };
      if (snapshot) {
        pushList(snapshot.list);
        pushList(snapshot.workspaces);
        pushList(snapshot.items);
      }
      const entries = [];
      const seen = new Set();
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const id = item.workspaceId !== undefined ? item.workspaceId : item.id;
        if (id === undefined || id === null) continue;
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        const path = typeof item.path === 'string' ? item.path : '';
        const fallback = path.split(/[\\/]/).filter(Boolean).pop() || key;
        const title = typeof item.title === 'string' && item.title !== '' ? item.title : fallback;
        entries.push({ id: key, title, sessionIds: Array.isArray(item.sessionIds) ? item.sessionIds.map(String) : [] });
      }
      return entries;
    }

    /*
     * Claude renders the running session's current plan steps underneath the
     * row (the indented lines joined by a connector line in its sidebar). The
     * Harness equivalent is the session's todo projection: `todos` keeps the
     * agent's plan with pending / in_progress / completed items, so the row can
     * show exactly what the run is doing right now.
     *
     * Fallbacks, in order:
     *   1. in-progress todo items (the real "current step");
     *   2. the first pending item when nothing is marked in progress;
     *   3. running subagent names ("子代理 · …") for runs delegating work,
     *      which is the closest honest "what is happening" for a run that has
     *      not written a todo list.
     */
    function stepsFor(id, projections, statuses) {
      const snapshot = projections && projections[id];
      const values = snapshot && snapshot.values;
      const todos = values && values.todos;
      if (Array.isArray(todos) && todos.length > 0) {
        const active = todos.filter((item) => item && item.status === 'in_progress');
        const pending = todos.filter((item) => item && item.status === 'pending');
        const picked = (active.length > 0 ? active : pending.slice(0, 1)).slice(0, 3);
        const lines = picked.map((item) => String(item.content || '')).filter(Boolean);
        if (lines.length > 0) return lines;
      }
      const catalog = values && values.subagentCatalog;
      if (Array.isArray(catalog) && catalog.length > 0) {
        const running = catalog.filter((entry) => {
          if (!entry) return false;
          const status = statuses && typeof statuses.get === 'function' ? statuses.get(entry.id) : undefined;
          return (status && status.running === true) || entry.running === true;
        });
        const lines = running.slice(0, 3).map((entry) => {
          const name = entry.displayTitle || entry.title || entry.name || entry.id;
          return '子代理 · ' + String(name);
        }).filter(Boolean);
        if (lines.length > 0) return lines;
      }
      return null;
    }

    function collect(list, statuses, workspaces, projections) {
      const counts = { blocked: 0, review: 0, working: 0, completed: 0, justCompleted: 0 };
      const groups = { blocked: [], review: [], working: [], completed: [] };
      const states = new Map();
      const needProjection = [];
      if (!list || !list.byId) return { counts, groups, states, needProjection };

      const ids = Array.isArray(list.ids) ? list.ids : Object.keys(list.byId);
      const archived = new Set();
      const rawArchived = workspaces && workspaces.archivedSessionIds;
      if (Array.isArray(rawArchived)) rawArchived.forEach((id) => archived.add(id));
      else if (rawArchived && typeof rawArchived.forEach === 'function') rawArchived.forEach((id) => archived.add(id));

      const t = strings();
      const projectOf = new Map();
      for (const workspace of workspaceEntries(workspaces)) {
        for (const sessionId of workspace.sessionIds) projectOf.set(String(sessionId), workspace.title);
      }
      for (const id of ids) {
        const session = list.byId[id];
        if (!session || session.blank === true || archived.has(id)) continue;
        const status = statuses && typeof statuses.get === 'function' ? statuses.get(id) : undefined;
        const bucket = bucketOf(status, session);
        const unread = !!(status && status.completionUnread === true);
        counts[bucket] += 1;
        if (bucket === 'completed' && unread) counts.justCompleted += 1;
        const title = displayTitle(session, t.untitled);
        const entry = {
          id,
          title,
          unread,
          project: projectOf.get(String(id)) || null,
          updatedAt: Number(session.updatedAt) || 0,
          steps: null,
        };
        if (bucket === 'working') {
          entry.steps = stepsFor(id, projections, statuses);
          const snapshot = projections && projections[id];
          const values = snapshot && snapshot.values;
          const loaded = !!(values && (Array.isArray(values.todos) || Array.isArray(values.subagentCatalog)));
          if (!loaded) needProjection.push(id);
        }
        groups[bucket].push(entry);
        states.set(id, { bucket, title, unread });
      }
      for (const key of GROUPS) {
        groups[key].sort((a, b) => (b.updatedAt - a.updatedAt) || (a.id < b.id ? -1 : 1));
      }
      return { counts, groups, states, needProjection };
    }

    // ---------------------------------------------------------- strip element
    function stripHost() {
      const slot = document.querySelector('[data-slot="sidebar.workspaces"]');
      if (slot !== null) {
        const parent = slot.parentElement;
        if (parent !== null) return parent;
      }
      return document.querySelector('[class*="_regionArea"]');
    }
    function sidebarCollapsed(host) {
      const rect = host.getBoundingClientRect();
      return rect.width > 0 && rect.width < 120;
    }

    let openSessionById = function () { };
    let refreshProjectionsById = function () { };
    const projectionRequests = new Map();

    /*
     * Working sessions only expose their todo steps once their projection is
     * loaded. The sidebar store keeps projections for open sessions; ask the
     * sessions service to load the rest (throttled), then the next snapshot
     * brings the steps into the rows.
     */
    function requestProjections(ids) {
      if (!Array.isArray(ids) || ids.length === 0) return;
      const now = Date.now();
      let budget = 6;
      for (const id of ids) {
        if (budget <= 0) return;
        if (now - (projectionRequests.get(id) || 0) < 5000) continue;
        projectionRequests.set(id, now);
        try { refreshProjectionsById(id); } catch (error) { }
        budget -= 1;
      }
    }

    function chevronSvg(open) {
      return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class="csb-caret" '
        + 'style="transform:rotate(' + (open ? 90 : 0) + 'deg)">'
        + '<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" '
        + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function dotHtml(color) {
      return '<span class="csb-dot" style="background:' + color + '"></span>';
    }

    // Exact replica of the shipped StateDot "ongoing" spinner: 14px SVG ring,
    // 1.5s rotation plus the breathing dash, so a running row in the status
    // table matches the native workspace list pixel for pixel.
    function spinnerHtml() {
      return '<svg class="csb-spin" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">'
        + '<g class="csb-spin-motion">'
        + '<circle class="csb-spin-track" cx="12" cy="12" r="9.5"></circle>'
        + '<circle class="csb-spin-arc" cx="12" cy="12" r="9.5"></circle>'
        + '</g></svg>';
    }

    /*
     * One session row. A running session gets the live spinner and, like
     * Claude, the steps it is executing right now (the session's in-progress
     * todo items) on indented lines below the title.
     */
    /*
     * The shipped folder icons (primitives IconFolderCloseRegular /
     * IconFolderOpenRegular, 16px, currentColor), so the status table reuses
     * exactly the same artwork as the native workspace list.
     */
    function folderSvg(open) {
      if (open) {
        return '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke-width="1">'
          + '<path d="M2.55912 7.93683C2.67584 7.49906 3.0723 7.19446 3.52536 7.19446H13.6491C14.3061 7.19446 14.7846 7.81725 14.6153 8.45209L13.4411 12.856C13.3244 13.2938 12.9279 13.5984 12.4748 13.5984H2.35113C1.69411 13.5984 1.21562 12.9756 1.38489 12.3407L2.55912 7.93683Z" fill="currentColor" opacity="0.16"/>'
          + '<path d="M13.6491 6.69446C14.6346 6.69453 15.3522 7.62895 15.0983 8.58118L13.9245 12.9845C13.7494 13.6412 13.1539 14.0988 12.4743 14.0988H2.35126C1.36574 14.0988 0.648153 13.1643 0.902044 12.212L2.07587 7.80774C2.25102 7.15128 2.84567 6.69455 3.52509 6.69446H13.6491ZM3.52509 7.69446C3.29865 7.69455 3.10004 7.84674 3.04169 8.06555L1.86786 12.4698C1.78345 12.7872 2.02285 13.0988 2.35126 13.0988H12.4743C12.7007 13.0988 12.8992 12.9463 12.9577 12.7277L14.1325 8.32336C14.2171 8.00598 13.9776 7.69453 13.6491 7.69446H3.52509Z" fill="currentColor"/>'
          + '<path d="M4.7666 1.90137C5.13227 1.90144 5.48571 2.03525 5.75977 2.27734L7.27246 3.61328C7.36379 3.69382 7.48174 3.73828 7.60352 3.73828H13.4502C14.2786 3.73828 14.9502 4.40985 14.9502 5.23828V5.69446H13.9502V5.23828C13.9502 4.96214 13.7263 4.73828 13.4502 4.73828H7.60352C7.23825 4.73828 6.88443 4.60465 6.61035 4.3623L5.09766 3.02637C4.99275 2.93377 4.88141 2.90139 4.7666 2.90137H2.0498C1.77366 2.90137 1.5498 3.12523 1.5498 3.40137V12.212L0.549805 12.5986V3.40137C0.549805 2.57294 1.22138 1.90137 2.0498 1.90137H4.7666Z" fill="currentColor"/>'
          + '</svg>';
      }
      return '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke-width="1">'
        + '<path d="M1.50439 3.11059C1.50439 2.55831 1.95211 2.1106 2.50439 2.1106H5.43389C5.67773 2.1106 5.91318 2.19969 6.09593 2.36113L7.71649 3.79265C7.89924 3.95409 8.1347 4.04319 8.3785 4.04319H13.4958C14.0481 4.04319 14.4958 4.4909 14.4958 5.04319V12.8894C14.4958 13.4417 14.0481 13.8894 13.4958 13.8894H2.50439C1.95211 13.8894 1.50439 13.4417 1.50439 12.8894V4.04319V3.11059Z" stroke="currentColor"/>'
        + '<path d="M3.63501 7.66614H12.3647" stroke="currentColor"/>'
        + '</svg>';
    }

    /*
     * One session row. A running session gets the live spinner and, like
     * Claude, the steps it is executing right now (the session's in-progress
     * todo items) on indented lines below the title. Every row also names the
     * project it belongs to in a small line under the title.
     */
    function sessionRowHtml(session, working) {
      const steps = working && Array.isArray(session.steps) ? session.steps : null;
      let html = '<button type="button" class="csb-session' + (working ? ' csb-session-working' : '') + '" '
        + 'data-csb-session="' + escapeHtml(session.id) + '" title="' + escapeHtml(session.title) + '">'
        + (working ? spinnerHtml() : '')
        + '<span class="csb-session-title">' + escapeHtml(session.title) + '</span>'
        + '</button>';
      if (steps !== null && steps.length > 0) {
        html += '<div class="csb-steps">';
        for (const step of steps) {
          html += '<div class="csb-step" title="' + escapeHtml(step) + '">' + escapeHtml(step) + '</div>';
        }
        html += '</div>';
      }
      return html;
    }

    /*
     * Sessions are grouped under their project, and the project line reuses the
     * native list's project tab: caret + folder icon + title on a 34px row.
     */
    function sessionsBlockHtml(sessions, working, t) {
      const order = [];
      const buckets = new Map();
      for (const session of sessions) {
        const key = session.project || '';
        if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
        buckets.get(key).push(session);
      }
      let html = '';
      for (const key of order) {
        const name = key || t.ungrouped;
        const isCollapsed = collapsedProjects.has(name);
        html += '<div class="csb-proj">'
          + '<button type="button" class="csb-proj-head" data-csb-project="' + escapeHtml(name) + '">'
          + '<span class="csb-proj-caret' + (isCollapsed ? '' : ' csb-open') + '">' + chevronSvg(!isCollapsed) + '</span>'
          + '<span class="csb-proj-folder">' + folderSvg(!isCollapsed) + '</span>'
          + '<span class="csb-proj-name">' + escapeHtml(name) + '</span>'
          + '</button>';
        if (!isCollapsed) {
          html += '<div class="csb-proj-sessions">';
          for (const session of buckets.get(key)) {
            html += sessionRowHtml(session, working);
          }
          html += '</div>';
        }
        html += '</div>';
      }
      return html;
    }

    // ------------------------------------------------------- state transitions
    /*
     * Claude's status-switch motion, read from its timeline CSS:
     *   enter/quiet move: .24s cubic-bezier(.3,.7,.4,1), translateY(6px) + fade;
     *   exit/quiet:       .18s ease-out, translateY(-4px) + fade.
     * The status table re-renders its rows whenever a session changes buckets, so
     * a FLIP pass keeps a row that moves between groups visually continuous.
     */
    const ANIM_EASE = 'cubic-bezier(.3,.7,.4,1)';
    let transitionUntil = 0;
    let deferredRenderTimer = 0;

    function reduceMotion() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; }
    }

    function captureSessions() {
      const strip = document.getElementById(STRIP_ID);
      if (strip === null) return null;
      const map = new Map();
      const rows = strip.querySelectorAll('[data-csb-session]');
      for (const row of rows) {
        const id = row.getAttribute('data-csb-session');
        if (!id) continue;
        map.set(id, { rect: row.getBoundingClientRect(), html: row.outerHTML });
      }
      return map;
    }

    function playSessionMoves(before) {
      if (before === null || before.size === 0 || reduceMotion()) return;
      const strip = document.getElementById(STRIP_ID);
      if (strip === null) return;
      let animated = false;
      const seen = new Set();
      for (const row of strip.querySelectorAll('[data-csb-session]')) {
        const id = row.getAttribute('data-csb-session');
        if (!id) continue;
        seen.add(id);
        const prev = before.get(id);
        const rect = row.getBoundingClientRect();
        if (prev === undefined) {
          try {
            row.animate(
              [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
              { duration: 240, easing: ANIM_EASE },
            );
            animated = true;
          } catch (error) { }
          continue;
        }
        const dx = prev.rect.left - rect.left;
        const dy = prev.rect.top - rect.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        try {
          row.animate(
            [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
            { duration: 240, easing: ANIM_EASE },
          );
          animated = true;
        } catch (error) { }
      }
      // Rows that vanished (their bucket collapsed) fade out from where they were.
      for (const id of before.keys()) {
        if (seen.has(id)) continue;
        const prev = before.get(id);
        try {
          const ghost = document.createElement('div');
          ghost.className = 'csb-ghost';
          ghost.setAttribute('aria-hidden', 'true');
          ghost.style.cssText = 'position:fixed;left:' + prev.rect.left + 'px;top:' + prev.rect.top
            + 'px;width:' + prev.rect.width + 'px;margin:0;padding:0;pointer-events:none;z-index:60;';
          ghost.innerHTML = prev.html;
          document.body.appendChild(ghost);
          const anim = ghost.animate(
            [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }],
            { duration: 180, easing: 'ease-out', fill: 'forwards' },
          );
          anim.onfinish = () => ghost.remove();
          animated = true;
        } catch (error) { }
      }
      if (animated) transitionUntil = performance.now() + 260;
    }

    let renderScheduled = false;
    let renderSignature = '';

    /*
     * Coalesce every render request into one animation frame: several status
     * snapshots can land in the same tick, and rebuilding twice would cancel
     * the first transition and look like a flash.
     */
    function renderStrip() {
      if (renderScheduled) return;
      renderScheduled = true;
      const flush = () => {
        renderScheduled = false;
        try {
          renderStripUnsafe();
        } catch (error) {
          reportError(error);
        }
      };
      try { window.requestAnimationFrame(flush); } catch (error) { flush(); }
    }

    function renderStripUnsafe() {
      const strip = document.getElementById(STRIP_ID);
      if (strip === null) return;
      const t = strings();
      const c = last.counts;
      const total = c.blocked + c.working + c.completed;
      if (total === 0) {
        strip.style.display = 'none';
        return;
      }
      // Decide visibility in the same frame as the paint: the sidebar can be in
      // rail mode, and a one-frame "block" would flash the table open.
      const hostRect = stripHost();
      strip.style.display = hostRect !== null && sidebarCollapsed(hostRect) ? 'none' : 'block';

      // Claude's own dot palette: warning for input, accent for review/unread,
      // muted for plain working/completed rows.
      const colors = {
        blocked: 'var(--dsw-alias-state-warn-primary,#e2a33c)',
        review: 'var(--dsw-alias-brand-primary,#5b8def)',
        working: 'var(--dsw-alias-state-idle-primary,rgba(150,155,165,.9))',
        completed: 'var(--dsw-alias-state-idle-primary,rgba(150,155,165,.9))',
      };
      const labels = { blocked: t.blocked, review: t.review, working: t.working, completed: t.completed };

      let body = '';
      for (const key of GROUPS) {
        const n = c[key];
        if (key === 'review' && n === 0) continue; // no review signal yet
        const isOpen = expanded.has(key);
        const sessions = last.groups[key];
        const canOpen = sessions.length > 0;
        body += '<div class="csb-group">'
          + '<button type="button" class="csb-group-head" data-csb-toggle="' + key + '" '
          + (canOpen ? '' : 'disabled ') + 'title="' + (isOpen ? t.collapse : t.expand) + '">'
          + '<span class="csb-group-caret' + (isOpen ? ' csb-open' : '') + '">' + chevronSvg(isOpen) + '</span>'
          + dotHtml(colors[key])
          + '<span class="csb-group-label">' + labels[key] + '</span>'
          + '<span class="csb-group-count">' + n + '</span>'
          + '</button>';
        if (isOpen && sessions.length > 0) {
          body += '<div class="csb-sessions">' + sessionsBlockHtml(sessions, key === 'working', t) + '</div>';
        }
        body += '</div>';
      }

      let summaryBody = '';
      if (collapsed) {
        // Collapsed view: running / waiting-for-input / just-finished keep
        // their session names underneath, with the same metrics as the list.
        // "Still finishing" sessions are not listed as finished yet.
        const justFinished = last.groups.completed.filter((session) => session.unread);
        const summaryRows = [
          { key: 'working', label: t.working, color: colors.working, sessions: last.groups.working },
          { key: 'blocked', label: t.blocked, color: colors.blocked, sessions: last.groups.blocked },
          { key: 'completed', label: t.justCompleted, color: 'var(--dsw-alias-brand-primary,#5b8def)', sessions: justFinished },
        ].filter((row) => row.sessions.length > 0);
        if (summaryRows.length > 0) {
          summaryBody = '<div class="csb-body csb-body-collapsed">'
            + summaryRows.map((row) => {
              let html = '<button type="button" class="csb-summary-row" '
                + 'data-csb-expand="' + row.key + '" title="' + t.expandAll + '">'
                + dotHtml(row.color)
                + '<span class="csb-group-label">' + row.label + '</span>'
                + '<span class="csb-group-count">' + row.sessions.length + '</span>'
                + '</button>';
              html += '<div class="csb-sessions">' + sessionsBlockHtml(row.sessions, row.key === 'working', t) + '</div>';
              return html;
            }).join('')
            + '</div>';
        }
      }

      // Collapsed header keeps the finished total on the right (the screenshot
      // baseline); the live categories render as rows underneath.
      const headSummary = collapsed && c.completed > 0
        ? '<span class="csb-head-summary"><span class="csb-head-count">'
          + dotHtml(colors.completed) + '<span>' + c.completed + '</span></span></span>'
        : '';

      const html = '<button type="button" class="csb-head-row" data-csb-collapse="1" '
        + 'title="' + (collapsed ? t.expandAll : t.collapseAll) + '">'
        + '<span class="csb-head-title">' + t.title + '</span>'
        + headSummary
        + '<span class="csb-head-caret' + (collapsed ? ' csb-collapsed' : '') + '">' + chevronSvg(!collapsed) + '</span>'
        + '</button>'
        + (collapsed ? summaryBody : '<div class="csb-body">' + body + '</div>');

      // Identical output means the snapshot changed nothing visible: keep the
      // DOM (and any in-flight transition) instead of rebuilding it, which is
      // what caused the flicker during streaming updates.
      const signature = (collapsed ? '1' : '0') + '|' + lang + '|'
        + Array.from(expanded).join(',') + '|' + Array.from(collapsedProjects).join(',') + '|' + html;
      if (signature === renderSignature && strip.childElementCount > 0) return;

      // A transition is still running: let it finish before swapping the DOM so
      // a rapid status flip cannot cut the previous motion in half.
      const now = performance.now();
      if (now < transitionUntil) {
        if (deferredRenderTimer === 0) {
          deferredRenderTimer = setTimeout(() => {
            deferredRenderTimer = 0;
            renderStrip();
          }, Math.ceil(transitionUntil - now) + 16);
        }
        return;
      }

      renderSignature = signature;
      const beforeSessions = captureSessions();
      strip.innerHTML = html;
      playSessionMoves(beforeSessions);
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[ch]));
    }

    function onStripClick(event) {
      if (event.target.closest('[data-csb-collapse]') !== null) {
        collapsed = !collapsed;
        writeBool(COLLAPSE_KEY, collapsed);
        renderStrip();
        return;
      }
      const expandRow = event.target.closest('[data-csb-expand]');
      if (expandRow !== null) {
        // Clicking a collapsed summary row opens the table on that group.
        collapsed = false;
        writeBool(COLLAPSE_KEY, collapsed);
        const key = expandRow.getAttribute('data-csb-expand');
        if (key) {
          expanded.add(key);
          saveExpanded();
        }
        renderStrip();
        return;
      }
      const toggle = event.target.closest('[data-csb-toggle]');
      if (toggle !== null) {
        const key = toggle.getAttribute('data-csb-toggle');
        if (!key) return;
        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);
        saveExpanded();
        renderStrip();
        return;
      }
      const project = event.target.closest('[data-csb-project]');
      if (project !== null) {
        const name = project.getAttribute('data-csb-project');
        if (!name) return;
        if (collapsedProjects.has(name)) collapsedProjects.delete(name);
        else collapsedProjects.add(name);
        saveCollapsedProjects();
        renderStrip();
        return;
      }
      const row = event.target.closest('[data-csb-session]');
      if (row !== null) {
        if (isSimulating) return; // simulated ids have no real session behind them
        const id = row.getAttribute('data-csb-session');
        if (id) openSessionById(id);
      }
    }

    function ensureStrip() {
      const host = stripHost();
      if (host === null) return null;
      let strip = document.getElementById(STRIP_ID);
      if (strip && strip.parentElement === host) return strip;
      if (strip) strip.remove();
      strip = document.createElement('div');
      strip.id = STRIP_ID;
      strip.setAttribute('role', 'region');
      strip.addEventListener('click', onStripClick);
      host.insertBefore(strip, host.firstChild);
      return strip;
    }

    // ------------------------------------------------------- single scrollbar
    /*
     * The status table and the workspace list must scroll together, not in two
     * panes. The shipped browser owns an inner scroll container; we flatten the
     * chain from that container up to the sidebar region and let the region
     * itself scroll, so there is exactly one scrollbar for both.
     */
    let scrollApplied = false;
    let savedStyles = [];

    function saveStyle(el, prop, value) {
      savedStyles.push({
        el,
        prop,
        previous: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop),
        had: el.style.getPropertyValue(prop) !== '',
      });
      el.style.setProperty(prop, value);
    }

    function findScroller(slot) {
      let best = null;
      let bestScore = 0;
      const all = slot.querySelectorAll('*');
      for (const el of all) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if (overflowY !== 'auto' && overflowY !== 'scroll') continue;
        const score = el.clientHeight;
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }
      return best;
    }

    function applySingleScroll(host) {
      if (scrollApplied) {
        // A browser re-render may have replaced the elements we flattened.
        const stale = savedStyles.some((item) => !item.el.isConnected);
        if (!stale) return;
        restoreSingleScroll();
      }
      const slot = host.querySelector('[data-slot="sidebar.workspaces"]');
      if (slot === null) return;
      const scroller = findScroller(slot);
      if (scroller === null) return;
      // Flatten the chain: every wrapper keeps its own height instead of
      // stretching, and only the host (sidebar region) scrolls.
      let node = scroller;
      while (node !== null && node !== host) {
        saveStyle(node, 'height', 'auto');
        saveStyle(node, 'min-height', '0');
        saveStyle(node, 'max-height', 'none');
        saveStyle(node, 'flex', 'none');
        saveStyle(node, 'overflow', 'visible');
        node = node.parentElement;
      }
      if (node === host) {
        saveStyle(host, 'overflow-y', 'auto');
        saveStyle(host, 'overflow-x', 'hidden');
      }
      scrollApplied = true;
    }

    function restoreSingleScroll() {
      for (const item of savedStyles) {
        try {
          if (item.had) item.el.style.setProperty(item.prop, item.previous, item.priority);
          else item.el.style.removeProperty(item.prop);
          if (item.el.getAttribute('style') === '') item.el.removeAttribute('style');
        } catch (error) { }
      }
      savedStyles = [];
      scrollApplied = false;
    }

    function mountScrolling(host) {
      try { applySingleScroll(host); } catch (error) { }
    }

    // ------------------------------------------------------------ the plugin
    function StatusTable(props) {
      const on = useEnabled();
      const langNow = useLang();
      const list = props.useSessions ? props.useSessions((s) => s) : undefined;
      const statuses = props.useSessionStatus ? props.useSessionStatus((s) => s) : undefined;
      const workspaces = props.useWorkspaces ? props.useWorkspaces((s) => s) : undefined;
      const projections = props.useSessions ? props.useSessions((s) => s.projectionsBySession) : undefined;
      const sim = useSimulate();

      React.useEffect(() => {
        if (!on) {
          const strip = document.getElementById(STRIP_ID);
          if (strip) strip.remove();
          return undefined;
        }
        let tries = 0;
        let timer = 0;
        let observer = null;
        const attach = (host) => {
          try {
            ensureStrip();
            mountScrolling(host);
          } catch (error) {
            reportError(error);
          }
          if (observer !== null || typeof ResizeObserver === 'undefined') return;
          observer = new ResizeObserver(() => {
            try {
              const strip = document.getElementById(STRIP_ID);
              if (strip) strip.style.display = sidebarCollapsed(host) ? 'none' : 'block';
            } catch (error) { }
          });
          observer.observe(host);
        };
        const mount = () => {
          try {
            const host = stripHost();
            if (host !== null) { attach(host); return; }
            if (tries++ < 40) timer = setTimeout(mount, 100);
          } catch (error) {
            reportError(error);
          }
        };
        mount();
        return () => {
          clearTimeout(timer);
          if (observer) observer.disconnect();
          const strip = document.getElementById(STRIP_ID);
          if (strip) strip.remove();
          restoreSingleScroll();
        };
      }, [on]);

      // Shadow demo: scripted phases cycle the whole flow without real runs.
      React.useEffect(() => {
        if (!sim) return undefined;
        isSimulating = true;
        // Open the interesting groups so the demo starts on the full picture.
        expanded.add('working');
        expanded.add('blocked');
        saveExpanded();
        const tick = () => {
          try {
            last = mockSnapshot();
            const host = stripHost();
            if (host === null) return;
            ensureStrip();
            mountScrolling(host);
            renderStrip();
            const strip = document.getElementById(STRIP_ID);
            if (strip) strip.style.display = sidebarCollapsed(host) ? 'none' : 'block';
          } catch (error) {
            reportError(error);
          }
        };
        tick();
        const timer = setInterval(() => {
          simPhase = (simPhase + 1) % 5;
          tick();
        }, 3500);
        return () => {
          clearInterval(timer);
          isSimulating = false;
        };
      }, [sim]);

      React.useEffect(() => {
        try {
          if (sim) return;
          last = collect(list, statuses, workspaces, projections);
          requestProjections(last.needProjection);
          if (!on) return;
          const host = stripHost();
          if (host === null) return;
          ensureStrip();
          mountScrolling(host);
          renderStrip();
          const strip = document.getElementById(STRIP_ID);
          if (strip) strip.style.display = sidebarCollapsed(host) ? 'none' : 'block';
        } catch (error) {
          reportError(error);
        }
      }, [on, list, statuses, workspaces, projections, langNow, sim]);

      return null;
    }

    function Switch(label, value, onToggle) {
      return React.createElement('button', {
        type: 'button',
        className: 'csb-switch',
        'data-on': value ? 'true' : 'false',
        'aria-pressed': value ? 'true' : 'false',
        'aria-label': label,
        onClick: () => onToggle(!value),
      }, React.createElement('span', null));
    }

    function SettingsRow() {
      const on = useEnabled();
      const sim = useSimulate();
      const error = useLastError();
      const t = strings();
      return React.createElement(
        'div',
        { className: 'csb-settings' },
        React.createElement('div', { className: 'csb-setting-row' },
          React.createElement('div', null,
            React.createElement('div', null, t.settingsTitle),
            React.createElement('small', null, t.settingsHint)),
          Switch(t.settingsTitle, on, setEnabled)),
        React.createElement('div', { className: 'csb-setting-row' },
          React.createElement('div', null,
            React.createElement('div', null, t.simSettings),
            React.createElement('small', null, t.simSettingsHint)),
          Switch(t.simSettings, sim, setSimulate)),
        error !== ''
          ? React.createElement('pre', { className: 'csb-error' }, error)
          : null,
      );
    }

    // The same style rules serve the real strip and the exit ghosts (`.csb-ghost`
    // is the off-tree clone used while a row fades away).
    const STRIP_SELECTOR = ':is(#' + STRIP_ID + ',.csb-ghost)';

    const CSS = `
${STRIP_SELECTOR}{margin:2px 0 6px;padding:0 8px 0 0;color:var(--dsw-alias-label-tertiary);user-select:none;font-size:14px;line-height:20px}
${STRIP_SELECTOR} .csb-head-row{display:flex;align-items:center;gap:6px;width:100%;height:36px;padding:0 8px 0 4px;margin-bottom:4px;box-sizing:border-box;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:left;cursor:pointer}
${STRIP_SELECTOR} .csb-head-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
${STRIP_SELECTOR} .csb-head-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
${STRIP_SELECTOR} .csb-head-summary{display:inline-flex;align-items:center;gap:10px;flex:none;font-size:14px;line-height:20px}
${STRIP_SELECTOR} .csb-head-count{display:inline-flex;align-items:center;gap:5px}
${STRIP_SELECTOR} .csb-head-caret{display:inline-flex;align-items:center;justify-content:center;width:14px;height:20px;flex:none;color:var(--dsw-alias-label-caption,rgba(127,127,127,.9))}
${STRIP_SELECTOR} .csb-head-caret svg{transition:transform .15s ease}
${STRIP_SELECTOR} .csb-group{display:flex;flex-direction:column}
${STRIP_SELECTOR} .csb-group-head{display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:0 8px 0 4px;box-sizing:border-box;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:left;cursor:pointer}
${STRIP_SELECTOR} .csb-group-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
${STRIP_SELECTOR} .csb-group-head:disabled{cursor:default;opacity:.55}
${STRIP_SELECTOR} .csb-summary-row{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px 0 4px;box-sizing:border-box;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer}
${STRIP_SELECTOR} .csb-summary-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
${STRIP_SELECTOR} .csb-group-head:disabled:hover{background:transparent}
${STRIP_SELECTOR} .csb-group-caret{display:inline-flex;align-items:center;justify-content:center;width:14px;height:20px;flex:none;color:var(--dsw-alias-label-caption,rgba(127,127,127,.9));transition:transform .15s ease;transform:rotate(0deg)}
${STRIP_SELECTOR} .csb-group-caret svg{transition:transform .15s ease}
${STRIP_SELECTOR} .csb-dot{width:8px;height:8px;border-radius:50%;flex:none}
${STRIP_SELECTOR} .csb-group-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${STRIP_SELECTOR} .csb-group-count{flex:none;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:20px}
${STRIP_SELECTOR} .csb-body>*+*{margin-top:2px}
${STRIP_SELECTOR} .csb-sessions{display:flex;flex-direction:column}
${STRIP_SELECTOR} .csb-sessions>*+*{margin-top:2px}
/* Titles line up with the group label above (4 + 14 caret + 6 + 8 dot + 6). */
${STRIP_SELECTOR} .csb-session{display:flex;align-items:center;gap:6px;height:32px;padding:0 8px 0 38px;box-sizing:border-box;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-primary,#e8e8ea);font:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;width:100%}
${STRIP_SELECTOR} .csb-session-working{padding-left:18px}
${STRIP_SELECTOR} .csb-body-collapsed .csb-session{padding-left:20px}
/* Project tab above its sessions — same metrics as the native project row. */
${STRIP_SELECTOR} .csb-proj{display:flex;flex-direction:column}
${STRIP_SELECTOR} .csb-proj+.csb-proj{margin-top:2px}
${STRIP_SELECTOR} .csb-proj-head{display:flex;align-items:center;gap:6px;height:34px;padding:0 8px 0 38px;box-sizing:border-box;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-primary,#e8e8ea);font:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;width:100%}
${STRIP_SELECTOR} .csb-proj-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
${STRIP_SELECTOR} .csb-proj-caret{display:inline-flex;align-items:center;justify-content:center;width:14px;height:20px;flex:none;color:var(--dsw-alias-label-caption,rgba(127,127,127,.9))}
${STRIP_SELECTOR} .csb-proj-caret svg{transition:transform .15s ease;transform:rotate(0deg)}
${STRIP_SELECTOR} .csb-proj-caret.csb-open svg{transform:rotate(90deg)}
${STRIP_SELECTOR} .csb-proj-folder{display:inline-flex;align-items:center;flex:none;color:var(--dsw-alias-label-tertiary)}
${STRIP_SELECTOR} .csb-proj-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${STRIP_SELECTOR} .csb-proj-sessions{display:flex;flex-direction:column}
${STRIP_SELECTOR} .csb-proj-sessions>*+*{margin-top:2px}
/* Session rows align their leading icon with the project folder icon and their
   titles with the project title (folder 58..74, title 80). */
${STRIP_SELECTOR} .csb-proj-sessions .csb-session{padding-left:80px}
${STRIP_SELECTOR} .csb-proj-sessions .csb-session-working{padding-left:58px;gap:8px}
${STRIP_SELECTOR} .csb-proj-sessions .csb-steps{margin-left:58px;padding-left:21px}
${STRIP_SELECTOR} .csb-body-collapsed .csb-proj-head{height:28px;padding-left:20px}
${STRIP_SELECTOR} .csb-body-collapsed .csb-proj-sessions .csb-session{padding-left:62px}
${STRIP_SELECTOR} .csb-body-collapsed .csb-proj-sessions .csb-session-working{padding-left:40px;gap:8px}
${STRIP_SELECTOR} .csb-body-collapsed .csb-proj-sessions .csb-steps{margin-left:40px;padding-left:21px}
${STRIP_SELECTOR} .csb-body-collapsed .csb-session-working{padding-left:0}
${STRIP_SELECTOR} .csb-session:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
${STRIP_SELECTOR} .csb-spin{flex:none;color:var(--dsw-alias-label-tertiary)}
${STRIP_SELECTOR} .csb-spin-motion{transform-origin:center;animation:csb-spin-rotate 1.5s linear infinite}
${STRIP_SELECTOR} .csb-spin-track,${STRIP_SELECTOR} .csb-spin-arc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
${STRIP_SELECTOR} .csb-spin-track{opacity:.25}
${STRIP_SELECTOR} .csb-spin-arc{stroke-dasharray:12 150;animation:csb-spin-dash 1.5s ease-in-out infinite}
${STRIP_SELECTOR} .csb-steps{margin:1px 0 4px 18px;padding-left:19px;border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));display:flex;flex-direction:column;gap:2px}
/* Step lines use the session-row metrics: 32px tall, 14px / 20px text, 2px gaps. */
${STRIP_SELECTOR} .csb-step{display:flex;align-items:center;height:32px;box-sizing:border-box;font-size:14px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background-image:linear-gradient(90deg,var(--dsw-alias-label-tertiary,rgba(150,150,160,.9)) 0%,var(--dsw-alias-label-tertiary,rgba(150,150,160,.9)) 40%,#ffffff 50%,var(--dsw-alias-label-tertiary,rgba(150,150,160,.9)) 60%,var(--dsw-alias-label-tertiary,rgba(150,150,160,.9)) 100%);background-size:220% 100%;background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:csb-step-sweep 2.4s linear infinite}
@keyframes csb-step-sweep{0%{background-position:100% 0}100%{background-position:0% 0}}
@media (prefers-reduced-motion:reduce){${STRIP_SELECTOR} .csb-step{animation:none;background:none;-webkit-text-fill-color:currentColor;color:var(--dsw-alias-label-tertiary)}}
@media (prefers-reduced-motion:reduce){${STRIP_SELECTOR} .csb-spin-motion,${STRIP_SELECTOR} .csb-spin-arc{animation:none}}
@keyframes csb-spin-rotate{to{transform:rotate(360deg)}}
@keyframes csb-spin-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
${STRIP_SELECTOR} .csb-session-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${STRIP_SELECTOR} .csb-session-empty{padding-left:26px;color:var(--dsw-alias-label-tertiary);cursor:default}
${STRIP_SELECTOR} .csb-session-empty:hover{background:transparent}
.csb-settings{display:flex;flex-direction:column;gap:10px;padding:10px 0;font-size:13px}
.csb-setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.csb-error{margin:6px 0 0;padding:6px 8px;border-radius:6px;background:rgba(220,70,70,.12);color:#e08a8a;font-size:10.5px;line-height:14px;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto}
.csb-settings small{display:block;margin-top:2px;font-size:11.5px;color:var(--dsw-alias-label-secondary,rgba(127,127,127,.8));font-weight:400}
.csb-switch{position:relative;flex:0 0 auto;width:36px;height:20px;border-radius:10px;border:0;background:rgba(127,127,127,.35);cursor:pointer;transition:background .16s}
.csb-switch[data-on=true]{background:#3fbf7f}
.csb-switch span{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .16s}
.csb-switch[data-on=true] span{transform:translateX(16px)}
`;

    function ensureStyle() {
      if (document.getElementById(STYLE_ID)) return;
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
    }

    function apply(ctx) {
      ensureStyle();
      openSessionById = (id) => {
        try { ctx.uiWorkspace.openSession(id); } catch (error) { }
      };
      refreshProjectionsById = (id) => {
        try {
          const pending = ctx.sessions.refreshProjections(id);
          if (pending && typeof pending.catch === 'function') pending.catch(() => { });
        } catch (error) { }
      };
      const syncLang = () => {
        const next = langOf(ctx.locale.getLocale());
        if (next !== lang) {
          lang = next;
          langListeners.forEach((fn) => fn());
          renderStrip();
        }
      };
      syncLang();
      ctx.effect(() => ctx.locale.subscribe(syncLang), 'dsh-pulse: locale');
      ctx.effect(
        () => () => {
          if (deferredRenderTimer) {
            clearTimeout(deferredRenderTimer);
            deferredRenderTimer = 0;
          }
          const strip = document.getElementById(STRIP_ID);
          if (strip) strip.remove();
          const style = document.getElementById(STYLE_ID);
          if (style) style.remove();
        },
        'dsh-pulse: strip cleanup',
      );

      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          { name: 'sidebar.footer.action', id: 'pulse-status-strip', order: 50 },
          StatusTable,
        ),
      );
      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          { name: 'settings.general.item', id: 'pulse-status-strip', order: 26 },
          SettingsRow,
        ),
      );
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'sessions'],
      apply,
    };
  },
});
