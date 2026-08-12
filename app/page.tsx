"use client";

import { useEffect, useMemo, useState } from "react";
import { countArticleCharacters, parseArticleMarkdown } from "@/lib/generated-article";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cloud,
  Copy,
  Edit3,
  Eye,
  FilePenLine,
  FileText,
  Filter,
  Image as ImageIcon,
  Lightbulb,
  ListFilter,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  ExternalLink,
  Palette,
  PenTool,
  Plus,
  RefreshCcw,
  Rocket,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  UploadCloud,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

type Page =
  | "dashboard"
  | "news"
  | "analysis"
  | "new-analysis"
  | "report"
  | "create"
  | "publish"
  | "editor"
  | "settings";

const nav = [
  { id: "dashboard", label: "工作台", icon: BarChart3 },
  { id: "news", label: "资讯采集", icon: Activity },
  { id: "analysis", label: "选题分析", icon: Lightbulb },
  { id: "create", label: "内容创作", icon: PenTool },
  { id: "publish", label: "发布管理", icon: Send },
  { id: "settings", label: "系统设置", icon: Settings },
] as const;

const articles = [
  {
    title: "OpenAI 最新 Agent 实战：一个人就是一支团队",
    source: "AI 科技评论",
    views: "10万+",
    likes: "4,826",
    rate: "7.9%",
  },
  {
    title: "我用 AI Agent 重做了自己的工作流",
    source: "少数派",
    views: "98,426",
    likes: "4,219",
    rate: "8.6%",
  },
  {
    title: "2026 年，普通人怎么用好智能体？",
    source: "数字力场",
    views: "86,921",
    likes: "3,684",
    rate: "7.2%",
  },
  {
    title: "别再做 Chatbot 了，Agent 才是未来",
    source: "机器之心",
    views: "75,310",
    likes: "3,206",
    rate: "6.8%",
  },
  {
    title: "从零搭建第一个能干活的 AI Agent",
    source: "效率笔记",
    views: "67,882",
    likes: "2,941",
    rate: "8.1%",
  },
];

type ContentRow = {
  id: string;
  versionId?: string;
  title: string;
  desc: string;
  platforms: string[];
  status: string;
  time: string;
  daysAgo: number;
  tone: string;
  resultMessage?: string;
  errorMessage?: string;
  externalUrl?: string;
  externalId?: string;
  createdAt?: string;
  body?: string;
  images?: string[];
};

type GeneratedContent = {
  content: any;
  article: {
    title: string;
    excerpt: string;
    imageQuery: string;
    lead: string;
    blocks: Array<{ heading?: string; text: string }>;
    actualLength: number;
  };
  warning?: string | null;
};

const contentRows: ContentRow[] = [];

const wechatBackendUrl =
  "https://mp.weixin.qq.com/cgi-bin/loginpage?t=wxm2-login&lang=zh_CN";

function contentTime(createdAt?: string) {
  if (!createdAt) return "时间未记录";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "时间未记录";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function contentDaysAgo(createdAt?: string) {
  if (!createdAt) return 0;
  const time = new Date(createdAt).getTime();
  return Number.isNaN(time)
    ? 0
    : Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function AppLogo() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Sparkles size={18} />
      </div>
      <div>
        <b>墨子</b>
        <span>内容工厂</span>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  go,
  open,
  close,
}: {
  page: Page;
  go: (p: Page) => void;
  open: boolean;
  close: () => void;
}) {
  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-top">
          <AppLogo />
          <button className="icon-btn mobile-close" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <div className="avatar small">墨</div>
          <div>
            <b>墨子内容团队</b>
            <span>个人工作区</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {nav.map((item) => {
            const I = item.icon;
            const active =
              item.id === page ||
              (item.id === "analysis" &&
                ["new-analysis", "report"].includes(page)) ||
              (item.id === "create" && page === "editor");
            return (
              <button
                key={item.id}
                className={active ? "active" : ""}
                onClick={() => {
                  go(item.id as Page);
                  close();
                }}
              >
                <I size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <div className="profile">
            <div className="avatar">M</div>
            <div>
              <b>墨子</b>
              <span>管理员</span>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={close} />}
    </>
  );
}

function Topbar({
  title,
  subtitle,
  menu,
}: {
  title: string;
  subtitle?: string;
  menu: () => void;
}) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={menu}>
        <Menu size={20} />
      </button>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="top-actions">
        <button className="search-pill">
          <Search size={16} />
          搜索内容 <kbd>⌘ K</kbd>
        </button>
        <button className="icon-btn dot">
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}

function StatCard({ label, value, hint, icon: Icon, color }: any) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={19} />
      </div>
      <div className="stat-label">{label}</div>
      <strong>{value}</strong>
      <div className="stat-hint">
        <TrendingUp size={13} />
        {hint}
      </div>
    </div>
  );
}

function Dashboard({ go }: { go: (p: Page) => void }) {
  return (
    <>
      <div className="hero-row">
        <div>
          <div className="eyebrow">2026 年 8 月 2 日 · 星期日</div>
          <h2>
            早上好，墨子 <span>👋</span>
          </h2>
          <p>今天也从一个好选题开始。你的内容生产线运转良好。</p>
        </div>
        <button className="primary" onClick={() => go("new-analysis")}>
          <Plus size={17} />
          新建选题分析
        </button>
      </div>
      <div className="stats-grid">
        <StatCard
          label="本周采集"
          value="126"
          hint="较上周 +18.2%"
          icon={Cloud}
          color="purple"
        />
        <StatCard
          label="生成洞察"
          value="8"
          hint="较上周 +3 个"
          icon={Lightbulb}
          color="blue"
        />
        <StatCard
          label="待发布内容"
          value="12"
          hint="3 篇今日新增"
          icon={FilePenLine}
          color="orange"
        />
        <StatCard
          label="本周已发布"
          value="23"
          hint="发布成功率 95.8%"
          icon={Rocket}
          color="green"
        />
      </div>
      <div className="dash-grid">
        <section className="card span2">
          <div className="section-head">
            <div>
              <h3>最近分析任务</h3>
              <p>追踪选题采集和 AI 分析进度</p>
            </div>
            <button className="text-btn" onClick={() => go("analysis")}>
              查看全部 <ArrowRight size={15} />
            </button>
          </div>
          <div className="task-list">
            {[
              {
                name: "AI Agent 八月选题分析",
                key: "AI Agent",
                num: "50 篇",
                status: "已完成",
                time: "今天 10:20",
                icon: "AI",
              },
              {
                name: "个人知识管理趋势",
                key: "知识库 · 第二大脑",
                num: "32 篇",
                status: "分析中 72%",
                time: "今天 09:45",
                icon: "知",
              },
              {
                name: "短视频创作工具盘点",
                key: "AI 视频 · 创作工具",
                num: "46 篇",
                status: "已完成",
                time: "昨天 16:30",
                icon: "视",
              },
            ].map((t, i) => (
              <div
                className="task-item"
                key={t.name}
                onClick={() => i !== 1 && go("report")}
              >
                <div className={`task-symbol s${i}`}>{t.icon}</div>
                <div className="task-main">
                  <b>{t.name}</b>
                  <span>
                    {t.key} · {t.num}
                  </span>
                </div>
                <div className={`status ${i === 1 ? "processing" : "done"}`}>
                  {i === 1 ? <LoaderCircle size={13} /> : <Check size={13} />}{" "}
                  {t.status}
                </div>
                <time>{t.time}</time>
                <ChevronRight size={16} />
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <h3>内容进度</h3>
              <p>本周生产漏斗</p>
            </div>
            <MoreHorizontal size={18} />
          </div>
          <div className="funnel">
            <div>
              <span>已生成</span>
              <b>36</b>
              <i style={{ width: "100%" }} />
            </div>
            <div>
              <span>待发布</span>
              <b>12</b>
              <i style={{ width: "64%" }} />
            </div>
            <div>
              <span>待发布</span>
              <b>5</b>
              <i style={{ width: "38%" }} />
            </div>
            <div>
              <span>已发布</span>
              <b>23</b>
              <i style={{ width: "78%" }} />
            </div>
          </div>
          <button className="secondary full" onClick={() => go("publish")}>
            进入发布管理
          </button>
        </section>
        <section className="card span2">
          <div className="section-head">
            <div>
              <h3>待办内容</h3>
              <p>优先处理这些内容任务</p>
            </div>
          </div>
          <div className="todo-list">
            <div>
              <span className="todo-icon warn">
                <CircleAlert size={17} />
              </span>
              <p>
                <b>3 篇文章等待发布</b>
                <span>确认发布渠道后即可发布</span>
              </p>
              <button onClick={() => go("publish")}>去发布</button>
            </div>
            <div>
              <span className="todo-icon error">
                <RefreshCcw size={17} />
              </span>
              <p>
                <b>1 篇小红书内容发布失败</b>
                <span>账号授权可能已经失效</span>
              </p>
              <button onClick={() => go("publish")}>查看原因</button>
            </div>
          </div>
        </section>
        <section className="card tip-card">
          <div className="tip-glow" />
          <div className="tip-icon">
            <Sparkles size={20} />
          </div>
          <span>今日创作灵感</span>
          <h3>“AI 的价值不是替代人，而是让每个人都拥有一支数字团队。”</h3>
          <button onClick={() => go("create")}>
            基于灵感创作 <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}

function NewsCollector({ go }: { go: (p: Page) => void }) {
  const [hours, setHours] = useState<6 | 12 | 24>(24);
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const load = () => {
    fetch("/api/news-collector/status")
      .then((r) => r.json())
      .then((r) => r.ok && setStatus(r.data));
    fetch("/api/news-collector/latest")
      .then((r) => r.json())
      .then((r) => r.ok && setLatest(r.data))
      .catch(() => {});
  };
  useEffect(load, []);
  const run = async () => {
    setRunning(true);
    setNotice(`正在采集过去 ${hours} 小时资讯，这可能需要 2–3 分钟…`);
    try {
      const r = await fetch("/api/news-collector/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours, intent: "subscription_collection" }),
      });
      const result = await r.json();
      if (!result.ok) throw new Error(result.error?.message || "采集失败");
      setNotice(
        `采集完成：${result.data.articleCount} 条资讯，${result.data.topicCandidateCount} 个选题候选`,
      );
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "采集失败");
    } finally {
      setRunning(false);
    }
  };
  const sources = latest?.sourceItems || [];
  const topics = latest?.topicCandidates || [];
  const chineseSources = sources.filter((x: any) => x.is_chinese_ready);
  const chineseTopics = topics.filter((x: any) => x.is_chinese_ready);
  const pendingTranslation = sources.length - chineseSources.length;
  const visibleSources = chineseSources.filter(
    (x: any) => category === "all" || x.display_category === category,
  );
  const sourceCount = new Set(chineseSources.map((x: any) => x.source_name))
    .size;
  const filters = [
    { id: "all", label: "全部" },
    { id: "product", label: "产品动态" },
    { id: "research", label: "技术研究" },
    { id: "open_source", label: "开源项目" },
  ];
  const evidenceLabel = (x: any) =>
    x.is_official_source
      ? "官方来源"
      : x.is_primary_source
        ? "一手来源"
        : x.source_reliability >= 0.7
          ? "可信媒体"
          : "单一来源待核验";
  return (
    <>
      <div className="news-control card">
        <div>
          <span className="collector-label">
            <Sparkles size={13} />
            AI NEWS COLLECTOR
          </span>
          <h2>今天有什么值得关注？</h2>
          <p>采集公开 AI 资讯源，自动完成标准化、去重、聚类和选题候选生成。</p>
        </div>
        <div className="collector-actions">
          <div className="window-switch">
            {([6, 12, 24] as const).map((x) => (
              <button
                key={x}
                className={hours === x ? "active" : ""}
                onClick={() => setHours(x)}
              >
                {x} 小时
              </button>
            ))}
          </div>
          <button
            className="primary collect-btn"
            onClick={run}
            disabled={running}
          >
            {running ? (
              <>
                <LoaderCircle size={16} className="collect-spinner" />
                采集中…
              </>
            ) : (
              <>
                <RefreshCcw size={16} />
                立即采集
              </>
            )}
          </button>
        </div>
      </div>
      <div className="news-kpis">
        <div className="card news-kpi">
          <span>可用中文资讯</span>
          <b>{chineseSources.length}</b>
          <small className="good">
            {pendingTranslation
              ? `${pendingTranslation} 条外文待翻译`
              : "已完成中文质检"}
          </small>
        </div>
        <div className="card news-kpi">
          <span>覆盖来源</span>
          <b>{sourceCount}</b>
          <small>公开 API · RSS · GitHub</small>
        </div>
        <div className="card news-kpi">
          <span>可用选题候选</span>
          <b>{chineseTopics.length}</b>
          <small>仅展示中文完整的候选</small>
        </div>
        <div className="card news-kpi">
          <span>采集器状态</span>
          <b style={{ fontSize: 16 }}>
            {status?.installed ? "运行正常" : "未连接"}
          </b>
          <small className={status?.installed ? "good" : ""}>
            本地 Skill 模式
          </small>
        </div>
      </div>
      <div className="collector-grid">
        <section className="card news-feed">
          <div className="news-feed-head">
            <div>
              <h3>今日资讯池</h3>
              <p>
                默认只显示完成中文处理的资讯；点击任意一条查看来源和评分依据
              </p>
            </div>
            <div className="source-filter">
              {filters.map((x) => (
                <button
                  key={x.id}
                  className={category === x.id ? "active" : ""}
                  onClick={() => setCategory(x.id)}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          {visibleSources.length ? (
            visibleSources.slice(0, 12).map((x: any, i: number) => (
              <article
                className="news-item"
                key={x.item_uid || i}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(x)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(x);
                  }
                }}
              >
                <div className="source-glyph">
                  {String(x.source_name || "AI").slice(0, 2)}
                </div>
                <div>
                  <div className="news-title-line">
                    <h4>{x.display_title}</h4>
                    <span
                      className={
                        x.is_official_source || x.is_primary_source
                          ? "source-proof"
                          : "source-proof pending"
                      }
                    >
                      {evidenceLabel(x)}
                    </span>
                  </div>
                  <p>{x.display_summary || "该条资讯暂无摘要。"}</p>
                  <div className="news-meta">
                    <span>{x.source_name}</span>
                    <span>{x.platform}</span>
                    <span>
                      {x.published_at
                        ? new Date(x.published_at).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "时间未知"}
                    </span>
                  </div>
                </div>
                <div className="news-rank">
                  <b>{Math.round(Number(x.collector_rank_score || 0) * 100)}</b>
                  <span>采集优先级</span>
                  <small>不代表真实性</small>
                </div>
              </article>
            ))
          ) : (
            <div className="collector-empty">
              <Cloud size={31} />
              <h3>
                {chineseSources.length
                  ? "这个分类暂时没有资讯"
                  : "暂无可用中文资讯"}
              </h3>
              <p>
                {pendingTranslation
                  ? `${pendingTranslation} 条外文资讯正在等待翻译，不会混入中文列表。`
                  : "点击“立即采集”生成第一个 24 小时资讯池。"}
              </p>
            </div>
          )}
        </section>
        <aside className="card topic-board">
          <h3>选题候选</h3>
          <p>由中文资讯生成，进入创作前仍需完成选题诊断。</p>
          {chineseTopics.length ? (
            chineseTopics.slice(0, 6).map((x: any, i: number) => (
              <article className="topic-candidate" key={x.candidate_uid || i}>
                <span>候选 {String(i + 1).padStart(2, "0")}</span>
                <h4>{x.display_title}</h4>
                <p>{x.display_reason || "等待进一步选题分析"}</p>
                <footer>
                  <span>
                    选题价值 {Math.round(Number(x.topic_score || 0) * 100)}
                  </span>
                  <button onClick={() => go("create")}>
                    进入创作 <ArrowRight size={11} />
                  </button>
                </footer>
              </article>
            ))
          ) : (
            <div className="collector-empty compact">
              <h3>暂无中文选题</h3>
              <p>外文资讯完成翻译后会自动进入这里。</p>
            </div>
          )}
        </aside>
      </div>
      {selected && (
        <div
          className="news-detail-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <section
            className="news-detail"
            role="dialog"
            aria-modal="true"
            aria-label="资讯详情"
          >
            <button
              className="news-detail-close"
              aria-label="关闭"
              onClick={() => setSelected(null)}
            >
              <X size={17} />
            </button>
            <div className="news-detail-label">来源核验</div>
            <h3>{selected.display_title}</h3>
            <div className="news-detail-badges">
              <span>{evidenceLabel(selected)}</span>
              <span>原文链接可追溯</span>
            </div>
            <p className="news-detail-summary">
              {selected.display_summary || "暂无摘要"}
            </p>
            <dl className="news-detail-grid">
              <div>
                <dt>采集优先级</dt>
                <dd>
                  {Math.round(Number(selected.collector_rank_score || 0) * 100)}{" "}
                  / 100
                </dd>
              </div>
              <div>
                <dt>来源可靠度</dt>
                <dd>
                  {Math.round(Number(selected.source_reliability || 0) * 100)}%
                </dd>
              </div>
              <div>
                <dt>新鲜度</dt>
                <dd>
                  {Math.round(Number(selected.freshness_score || 0) * 100)}%
                </dd>
              </div>
              <div>
                <dt>互动数据</dt>
                <dd>
                  {selected.view_count || selected.like_count
                    ? "已采集"
                    : "缺失，使用中性默认值"}
                </dd>
              </div>
            </dl>
            <div className="news-score-note">
              <CircleAlert size={15} />
              <span>
                该分数只用于采集排序，不是事实核验分。重要结论仍需官方来源或多个独立来源交叉确认。
              </span>
            </div>
            {selected.title && selected.title !== selected.display_title && (
              <div className="news-original">
                <b>原始标题</b>
                <span>{selected.title}</span>
              </div>
            )}
            <a
              className="primary news-open-source"
              href={selected.url}
              target="_blank"
              rel="noreferrer"
            >
              打开原文 <ExternalLink size={14} />
            </a>
          </section>
        </div>
      )}
      {notice && <div className="collector-toast">{notice}</div>}
    </>
  );
}

function Analysis({ go }: { go: (p: Page) => void }) {
  const [q, setQ] = useState("");
  const [liveTasks, setLiveTasks] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/analysis-tasks")
      .then((r) => r.json())
      .then((r) => r.ok && setLiveTasks(r.data))
      .catch(() => {});
  }, []);
  const fallbackTasks = [
    ["AI Agent 八月选题分析", "AI Agent", "50", "已完成", "5 个", "今天 10:20"],
    ["个人知识管理趋势", "知识库、第二大脑", "32", "分析中", "—", "今天 09:45"],
    [
      "短视频创作工具盘点",
      "AI 视频、创作工具",
      "46",
      "已完成",
      "5 个",
      "昨天 16:30",
    ],
    [
      "大模型应用落地观察",
      "大模型、企业服务",
      "60",
      "已完成",
      "5 个",
      "07-30 11:24",
    ],
    [
      "AI 编程产品研究",
      "AI 编程、Vibe Coding",
      "38",
      "采集失败",
      "—",
      "07-29 19:08",
    ],
  ];
  const statusLabel = (s: string) =>
    ({
      queued: "已排队",
      collecting: "采集中",
      summarizing: "摘要中",
      analyzing: "洞察中",
      completed: "已完成",
      failed: "采集失败",
    })[s] || s;
  const liveRows = liveTasks.map((t) => [
    t.name,
    t.keywords.join("、"),
    String(t.articleCount || t.collectionLimit),
    statusLabel(t.status),
    t.insightCount ? `${t.insightCount} 个` : "—",
    new Date(t.createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  ]);
  const tasks = (liveRows.length ? liveRows : fallbackTasks).filter(
    (x) => String(x[0]).includes(q) || String(x[1]).includes(q),
  );
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>选题分析</h2>
          <p>从海量内容中发现值得创作的新机会</p>
        </div>
        <button className="primary" onClick={() => go("new-analysis")}>
          <Plus size={17} />
          新建分析
        </button>
      </div>
      <div className="card table-card">
        <div className="toolbar">
          <div className="inline-search">
            <Search size={16} />
            <input
              placeholder="搜索任务名称或关键词"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="filter-btn">
            <ListFilter size={16} />
            全部状态
            <ChevronDown size={14} />
          </button>
          <button className="filter-btn">
            <Clock3 size={16} />
            最近 30 天<ChevronDown size={14} />
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>任务名称</th>
                <th>关键词</th>
                <th>文章数</th>
                <th>状态</th>
                <th>洞察</th>
                <th>创建时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr
                  key={t[0]}
                  onClick={() => t[3] === "已完成" && go("report")}
                >
                  <td>
                    <div className={`task-symbol mini s${i % 3}`}>
                      {t[0].slice(0, 1)}
                    </div>
                    <b>{t[0]}</b>
                  </td>
                  <td>
                    <span className="tag">{t[1]}</span>
                  </td>
                  <td>{t[2]} 篇</td>
                  <td>
                    <span
                      className={`status ${t[3] === "已完成" ? "done" : t[3] === "分析中" ? "processing" : "failed"}`}
                    >
                      {t[3]}
                    </span>
                  </td>
                  <td>{t[4]}</td>
                  <td>{t[5]}</td>
                  <td>
                    <MoreHorizontal size={17} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>共 12 个分析任务</span>
          <div>
            <button disabled>‹</button>
            <button className="selected">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </div>
    </>
  );
}

function NewAnalysis({ go }: { go: (p: Page) => void }) {
  const [running, setRunning] = useState(false);
  const [tags, setTags] = useState(["AI Agent"]);
  const [input, setInput] = useState("");
  const [taskName, setTaskName] = useState("AI Agent 八月选题分析");
  const start = async () => {
    setRunning(true);
    try {
      const r = await fetch("/api/analysis-tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: taskName,
          keywords: tags,
          dateRangeDays: 7,
          collectionLimit: 50,
          excludedKeywords: [],
        }),
      });
      const result = await r.json();
      if (!result.ok) throw new Error(result.error?.message || "创建失败");
      go("analysis");
    } catch (error) {
      alert(error instanceof Error ? error.message : "创建失败");
      setRunning(false);
    }
  };
  return (
    <>
      <button className="back" onClick={() => go("analysis")}>
        <ArrowLeft size={16} />
        返回分析任务
      </button>
      <div className="form-layout">
        <main className="form-card">
          <div className="form-heading">
            <div className="step-badge">01</div>
            <div>
              <h2>创建选题分析</h2>
              <p>设置采集范围，AI 将自动完成摘要、统计和洞察。</p>
            </div>
          </div>
          <div className="form-section">
            <label>
              任务名称 <em>*</em>
            </label>
            <input className="input" defaultValue="AI Agent 八月选题分析" />
            <small>用于区分不同的分析任务</small>
          </div>
          <div className="form-section">
            <label>
              搜索关键词 <em>*</em>
            </label>
            <div className="tag-input">
              {tags.map((x) => (
                <span key={x}>
                  {x}
                  <X
                    size={13}
                    onClick={() => setTags(tags.filter((t) => t !== x))}
                  />
                </span>
              ))}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input) {
                    setTags([...tags, input]);
                    setInput("");
                  }
                }}
                placeholder="输入后按 Enter 添加"
              />
            </div>
            <small>建议添加 1–5 个相关关键词，结果更聚焦</small>
          </div>
          <div className="form-row">
            <div className="form-section">
              <label>时间范围</label>
              <select className="input">
                <option>最近 7 天</option>
                <option>最近 30 天</option>
                <option>最近 90 天</option>
              </select>
            </div>
            <div className="form-section">
              <label>采集数量</label>
              <select className="input">
                <option>50 篇</option>
                <option>100 篇</option>
                <option>200 篇</option>
              </select>
            </div>
          </div>
          <div className="form-section">
            <label>
              排除关键词 <span>选填</span>
            </label>
            <input className="input" placeholder="例如：招聘、广告、培训课程" />
          </div>
          <hr />
          <div className="form-section">
            <label>AI 分析模型</label>
            <div className="model-select">
              <div className="model-logo">
                <Bot size={20} />
              </div>
              <div>
                <b>GPT-5</b>
                <span>适合深度分析与内容洞察</span>
              </div>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="form-section">
            <label>
              补充分析要求 <span>选填</span>
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="例如：重点关注面向个人用户的实操类选题……"
            />
          </div>
          <div className="form-actions">
            <button className="secondary" onClick={() => go("analysis")}>
              取消
            </button>
            <button className="primary wide" onClick={start} disabled={running}>
              {running ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  正在启动分析…
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  开始采集与分析
                </>
              )}
            </button>
          </div>
        </main>
        <aside className="explain-card">
          <div className="magic-orb">
            <WandSparkles size={27} />
          </div>
          <h3>AI 会为你完成什么？</h3>
          {[
            [Cloud, "采集公众号文章", "按关键词获取近期高相关内容"],
            [FileText, "逐篇摘要分析", "提取主题、观点和关键信息"],
            [Activity, "聚合数据洞察", "计算热度、互动率与高频词"],
            [Lightbulb, "生成选题建议", "给出 5 个有数据依据的方向"],
          ].map(([I, t, d]: any, i) => (
            <div className="explain-step" key={t}>
              <span>{i + 1}</span>
              <I size={18} />
              <p>
                <b>{t}</b>
                <small>{d}</small>
              </p>
            </div>
          ))}
          <div className="time-est">
            <Clock3 size={16} />
            <span>预计需要 3–5 分钟，可离开当前页面</span>
          </div>
        </aside>
      </div>
    </>
  );
}

function Report({ go }: { go: (p: Page) => void }) {
  const [rank, setRank] = useState("阅读量");
  return (
    <>
      <button className="back" onClick={() => go("analysis")}>
        <ArrowLeft size={16} />
        返回分析任务
      </button>
      <div className="report-hero">
        <div className="report-icon">
          <Sparkles size={23} />
        </div>
        <div>
          <span className="status done">
            <Check size={12} />
            分析完成
          </span>
          <h2>AI Agent 八月选题洞察</h2>
          <p>基于 50 篇公众号文章 · 2026-07-26 至 2026-08-02</p>
        </div>
        <div className="report-actions">
          <button className="secondary">
            <UploadCloud size={16} />
            导出报告
          </button>
          <button className="secondary">
            <RefreshCcw size={16} />
            重新分析
          </button>
        </div>
      </div>
      <div className="report-stats">
        <div>
          <span>样本文章</span>
          <b>50</b>
          <small>来自 31 个公众号</small>
        </div>
        <div>
          <span>累计阅读</span>
          <b>
            286.4<span>万</span>
          </b>
          <small className="up">↑ 18.6% 热度上升</small>
        </div>
        <div>
          <span>平均互动率</span>
          <b>
            2.8<span>%</span>
          </b>
          <small>最高互动率 8.6%</small>
        </div>
        <div>
          <span>推荐选题</span>
          <b>5</b>
          <small>综合数据与内容缺口</small>
        </div>
      </div>
      <div className="report-grid">
        <section className="card word-card">
          <div className="section-head">
            <div>
              <h3>高频主题词</h3>
              <p>字号代表在样本文章中的出现频率</p>
            </div>
            <button className="icon-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="wordcloud">
            <b className="w1">AI Agent</b>
            <span className="w2">自动化</span>
            <span className="w3">工作流</span>
            <span className="w4">效率</span>
            <span className="w5">智能体</span>
            <span className="w6">大模型</span>
            <span className="w7">提示词</span>
            <span className="w8">编程</span>
            <span className="w9">数字员工</span>
            <span className="w10">知识库</span>
            <span className="w11">生产力</span>
            <span className="w12">工具</span>
          </div>
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <h3>内容趋势</h3>
              <p>近 7 天相关文章热度</p>
            </div>
            <span className="up-pill">↑ 24.8%</span>
          </div>
          <div className="chart">
            <div className="y-axis">
              <span>10万</span>
              <span>7.5万</span>
              <span>5万</span>
              <span>2.5万</span>
              <span>0</span>
            </div>
            <svg viewBox="0 0 500 170" preserveAspectRatio="none">
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#7456e8" stopOpacity=".25" />
                  <stop offset="1" stopColor="#7456e8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 145 C55 130,70 125,100 120 S150 100,180 108 S230 80,260 88 S310 56,340 65 S390 46,410 52 S460 18,500 25 L500 170 L0 170Z"
                fill="url(#area)"
              />
              <path
                d="M0 145 C55 130,70 125,100 120 S150 100,180 108 S230 80,260 88 S310 56,340 65 S390 46,410 52 S460 18,500 25"
                fill="none"
                stroke="#7456e8"
                strokeWidth="3"
              />
            </svg>
            <div className="x-axis">
              <span>07-27</span>
              <span>07-28</span>
              <span>07-29</span>
              <span>07-30</span>
              <span>07-31</span>
              <span>08-01</span>
              <span>08-02</span>
            </div>
          </div>
        </section>
      </div>
      <section className="card ranking">
        <div className="section-head">
          <div>
            <h3>热门文章榜单</h3>
            <p>发现表现最出色的内容样本</p>
          </div>
          <div className="segmented">
            {["阅读量", "点赞量", "互动率"].map((x) => (
              <button
                className={rank === x ? "active" : ""}
                onClick={() => setRank(x)}
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>文章</th>
                <th>公众号</th>
                <th>阅读量</th>
                <th>点赞数</th>
                <th>互动率</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a, i) => (
                <tr key={a.title}>
                  <td>
                    <span className={`rank r${i + 1}`}>{i + 1}</span>
                  </td>
                  <td>
                    <b>{a.title}</b>
                  </td>
                  <td>{a.source}</td>
                  <td>{a.views}</td>
                  <td>{a.likes}</td>
                  <td>
                    <b className="rate">{a.rate}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="insights">
        <div className="section-head">
          <div>
            <h3>AI 选题洞察</h3>
            <p>结合数据表现、内容缺口与受众需求生成</p>
          </div>
          <span className="ai-label">
            <Sparkles size={14} />
            AI GENERATED
          </span>
        </div>
        <div className="insight-list">
          {[
            [
              "01",
              "普通人如何搭建自己的第一支 AI 数字团队",
              "入门实操",
              "知识工作者",
              "相关实操内容的平均阅读量高出样本 42%，但多数文章停留在工具介绍，缺少可复用的落地流程。",
              "violet",
            ],
            [
              "02",
              "我把一周工作交给 5 个 Agent 后，发生了什么",
              "案例复盘",
              "职场人",
              "个人实践和结果对比类内容互动率达到 7.4%，真实体验比概念解读更容易引发讨论。",
              "blue",
            ],
            [
              "03",
              "别再收藏 AI 工具了：真正有效的是这套工作流",
              "观点方法",
              "效率爱好者",
              "“工具盘点”内容供给过剩，而工作流设计相关内容稀缺，存在明显的内容缺口。",
              "green",
            ],
            [
              "04",
              "零代码 Agent 实战：30 分钟自动生成每周报告",
              "教程指南",
              "非技术用户",
              "“零代码”和“自动化”组合词热度本周增长 68%，适合用明确结果吸引点击。",
              "orange",
            ],
            [
              "05",
              "AI Agent 会取代哪些工作？我们分析了 50 个案例",
              "趋势研究",
              "管理者",
              "趋势判断类内容阅读稳定，加入真实案例和数据可显著提高可信度与收藏率。",
              "rose",
            ],
          ].map((x: any) => (
            <article className="insight-card" key={x[0]}>
              <div className={`insight-no ${x[5]}`}>{x[0]}</div>
              <div className="insight-body">
                <div className="insight-title">
                  <h4>{x[1]}</h4>
                  <span>{x[2]}</span>
                  <span>{x[3]}</span>
                </div>
                <p>{x[4]}</p>
                <div className="why">
                  <TrendingUp size={15} />
                  <b>推荐理由：</b>数据热度高 · 内容缺口明显 · 适合双平台分发
                </div>
              </div>
              <button className="primary soft" onClick={() => go("create")}>
                <Sparkles size={15} />
                一键创作
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Create({ go }: { go: (p: Page) => void }) {
  const topics = [
    {
      id: "digital-team",
      title: "普通人如何搭建自己的第一支 AI 数字团队",
      source: "AI Agent 八月选题洞察",
    },
    {
      id: "zero-code",
      title: "零代码 Agent 实战：30 分钟自动生成每周报告",
      source: "AI Agent 八月选题洞察",
    },
    {
      id: "work-change",
      title: "AI Agent 会取代哪些工作？我们分析了 50 个案例",
      source: "AI Agent 八月选题洞察",
    },
    {
      id: "workflow",
      title: "5 个真正能提高效率的 AI 工作流",
      source: "效率工具选题洞察",
    },
    {
      id: "model-choice",
      title: "大模型选型：为什么不能只看排行榜",
      source: "AI 产品趋势洞察",
    },
  ];
  const defaults = {
    topicId: "digital-team",
    platforms: ["wechat", "xhs"],
    length: "1500–2000 字",
    style: "专业易懂",
    audience: "希望提高效率的知识工作者",
    purpose: "知识分享",
    images: 3,
    requirements: "",
  };
  const [generated, setGenerated] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicId, setTopicId] = useState(defaults.topicId);
  const [platforms, setPlatforms] = useState<string[]>(defaults.platforms);
  const [length, setLength] = useState(defaults.length);
  const [style, setStyle] = useState(defaults.style);
  const [audience, setAudience] = useState(defaults.audience);
  const [purpose, setPurpose] = useState(defaults.purpose);
  const [images, setImages] = useState(defaults.images);
  const [requirements, setRequirements] = useState(defaults.requirements);
  const [formNotice, setFormNotice] = useState("");
  const topic = topics.find((x) => x.id === topicId) || topics[0];
  const togglePlatform = (id: string) => {
    setFormNotice("");
    setPlatforms((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };
  const reset = () => {
    setTopicId(defaults.topicId);
    setPlatforms(defaults.platforms);
    setLength(defaults.length);
    setStyle(defaults.style);
    setAudience(defaults.audience);
    setPurpose(defaults.purpose);
    setImages(defaults.images);
    setRequirements(defaults.requirements);
    setTopicOpen(false);
    setGenerated(false);
    setGeneratedContent(null);
    setFormNotice("已恢复默认配置");
  };
  const generate = async () => {
    if (!platforms.length) {
      setFormNotice("请至少选择一个目标平台");
      return;
    }
    setFormNotice("");
    setBusy(true);
    setGenerated(false);
    setGeneratedContent(null);
    try {
      const [minLength, maxLength] = articleLengthBounds[length] || [1200, 1500];
      const response = await fetch("/api/contents/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic: topic.title,
          minLength,
          maxLength,
          style,
          platforms: platforms.map((platform) => platform === "xhs" ? "xiaohongshu" : platform),
          audience,
          purpose,
          requirements,
          imageCount: images,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error?.message || "文章生成失败");
      }
      setGeneratedContent(result.data);
      setGenerated(true);
      setFormNotice(result.data.warning || `生成完成，正文 ${result.data.article.actualLength} 字并已保存到内容库。`);
    } catch (error) {
      setFormNotice(error instanceof Error ? error.message : "文章生成失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>AI 内容创作</h2>
          <p>从洞察出发，创作适合不同平台的优质内容</p>
        </div>
        <button className="secondary" onClick={() => go("publish")}>
          <FileText size={16} />
          查看内容库
        </button>
      </div>
      <div className="create-layout">
        <aside className="creator-panel card">
          <div className="panel-title">
            <span>创作配置</span>
            <button type="button" onClick={reset}>
              <RefreshCcw size={14} />
              重置
            </button>
          </div>
          <div className="form-section topic-picker">
            <label>选题方向</label>
            <button
              type="button"
              className="chosen-topic"
              aria-haspopup="listbox"
              aria-expanded={topicOpen}
              onClick={() => setTopicOpen((x) => !x)}
            >
              <span className="topic-icon">
                <Lightbulb size={17} />
              </span>
              <p>
                <b>{topic.title}</b>
                <span>来自「{topic.source}」</span>
              </p>
              <ChevronDown size={16} className={topicOpen ? "rotated" : ""} />
            </button>
            {topicOpen && (
              <div className="topic-menu" role="listbox">
                {topics.map((x) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={topicId === x.id}
                    className={topicId === x.id ? "selected" : ""}
                    key={x.id}
                    onClick={() => {
                      setTopicId(x.id);
                      setTopicOpen(false);
                      setGenerated(false);
                    }}
                  >
                    <span>{x.title}</span>
                    <small>{x.source}</small>
                    {topicId === x.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="form-section">
            <label>
              目标平台 <span>可多选</span>
            </label>
            <div className="platform-options">
              <button
                type="button"
                aria-pressed={platforms.includes("wechat")}
                className={platforms.includes("wechat") ? "chosen" : ""}
                onClick={() => togglePlatform("wechat")}
              >
                <span className="wechat">微</span>
                <div>
                  <b>公众号</b>
                  <small>长文深度阅读</small>
                </div>
                {platforms.includes("wechat") ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <span className="platform-empty" />
                )}
              </button>
              <button
                type="button"
                aria-pressed={platforms.includes("xhs")}
                className={platforms.includes("xhs") ? "chosen" : ""}
                onClick={() => togglePlatform("xhs")}
              >
                <span className="xhs">小</span>
                <div>
                  <b>小红书</b>
                  <small>图文种草笔记</small>
                </div>
                {platforms.includes("xhs") ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <span className="platform-empty" />
                )}
              </button>
            </div>
          </div>
          <div className="form-row">
            <div className="form-section">
              <label>文章长度</label>
              <select
                className="input"
                value={length}
                onChange={(e) => {
                  setLength(e.target.value);
                  setGenerated(false);
                }}
              >
                <option>600–800 字</option>
                <option>800–1200 字</option>
                <option>1200–1500 字</option>
                <option>1500–2000 字</option>
                <option>2000–3000 字</option>
                <option>3000–5000 字</option>
                <option>5000 字以上</option>
              </select>
            </div>
            <div className="form-section">
              <label>写作风格</label>
              <select
                className="input"
                value={style}
                onChange={(e) => {
                  setStyle(e.target.value);
                  setGenerated(false);
                }}
              >
                <option>专业易懂</option>
                <option>轻松口语</option>
                <option>深度分析</option>
                <option>故事叙述</option>
                <option>犀利观点</option>
                <option>教程指南</option>
              </select>
            </div>
          </div>
          <div className="form-section">
            <label>目标读者</label>
            <input
              className="input"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
          <div className="form-section">
            <label>内容目的</label>
            <div className="chip-group">
              {["知识分享", "涨粉", "品牌塑造", "转化"].map((x) => (
                <button
                  type="button"
                  className={purpose === x ? "active" : ""}
                  onClick={() => setPurpose(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div className="form-section">
            <label>正文配图</label>
            <div className="range-row">
              <input
                type="range"
                min="0"
                max="10"
                value={images}
                onChange={(e) => setImages(Number(e.target.value))}
              />
              <b>{images} 张</b>
            </div>
            <small>将从 Unsplash 搜索并自动插入</small>
          </div>
          <div className="form-section">
            <label>
              补充要求 <span>选填</span>
            </label>
            <textarea
              className="input"
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="输入你希望强调的观点或写作要求"
            />
          </div>
          {formNotice && (
            <div
              className={platforms.length ? "form-notice" : "form-notice error"}
            >
              {formNotice}
            </div>
          )}
          <button
            className="primary full generate"
            onClick={generate}
            disabled={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={17} />
                AI 正在创作…
              </>
            ) : (
              <>
                <WandSparkles size={17} />
                {generated ? "按当前配置重新生成" : "生成完整文章"}
              </>
            )}
          </button>
        </aside>
        <main className="preview-panel card">
          {!generated ? (
            <div className="empty-editor">
              <div className="empty-art">
                <div className="page-sheet">
                  <Sparkles size={24} />
                  <i />
                  <i />
                  <i />
                </div>
                <span className="orb o1" />
                <span className="orb o2" />
              </div>
              <h3>准备开始创作</h3>
              <p>
                设置左侧创作参数，AI 将为你生成文章
                <br />
                并自动匹配相关图片。
              </p>
              <div className="process-hints">
                <span>
                  <Check size={14} />
                  生成内容大纲
                </span>
                <span>
                  <Check size={14} />
                  撰写完整正文
                </span>
                <span>
                  <Check size={14} />
                  自动搜索配图
                </span>
              </div>
            </div>
          ) : (
            <ArticlePreview
              go={go}
              generatedContent={generatedContent!}
              config={{
                topic,
                length,
                style,
                platforms,
                images,
                audience,
                purpose,
                requirements,
              }}
            />
          )}
        </main>
      </div>
    </>
  );
}

type PreviewConfig = {
  topic: { title: string };
  length: string;
  style: string;
  platforms: string[];
  images: number;
  audience: string;
  purpose: string;
  requirements: string;
};
const articleLengthBounds: Record<string, [number, number]> = {
  "600–800 字": [600, 800],
  "800–1200 字": [800, 1200],
  "1200–1500 字": [1200, 1500],
  "1500–2000 字": [1500, 2000],
  "2000–3000 字": [2000, 3000],
  "3000–5000 字": [3000, 5000],
  "5000 字以上": [5000, 5500],
};
const previewImageUrls = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
];
const countArticleChars = (value: string) => value.replace(/\s/g, "").length;
function buildPreviewArticle(config: PreviewConfig) {
  const [min, max] = articleLengthBounds[config.length] || [1200, 1500],
    target = Math.round((min + max) / 2);
  const title = config.topic.title;
  const lead = `这不是一份工具清单，而是一套面向${config.audience}、可以真正执行和复盘的方法。`;
  const units = [
    [
      "为什么现在必须重新设计工作方式",
      `很多人使用 AI 时，仍停留在“想到问题就问一句”的阶段。这样的用法当然能节省几分钟，却很难形成稳定产出。围绕“${title}”，真正需要改变的是任务组织方式：先明确结果，再设计步骤，最后让工具承担其中可以标准化的部分。`,
    ],
    [
      "先定义一个可检查的结果",
      `不要从“我要用哪个模型”开始，而要先写下最终交付物。例如一份结构完整的周报、一个经过核验的选题清单，或一篇可以进入审核流程的文章。结果越清楚，执行过程越容易拆分，也越容易判断 AI 到底有没有帮上忙。`,
    ],
    [
      "把任务拆成稳定的环节",
      `一个可靠流程通常包含输入、处理、检查和交付四个环节。输入决定材料范围，处理决定方法，检查负责发现遗漏，交付则规定格式与去向。把这些环节写清楚以后，每一步都能单独改进，不必每次从头尝试。`,
    ],
    [
      "给每个角色一张岗位说明书",
      `无论使用单个助手还是多个智能体，都要明确职责边界。岗位说明书至少应包含目标、可用资料、执行步骤、禁止事项和完成标准。这样做能够减少看似流畅但无法落地的回答，也能让后续协作更加稳定。`,
    ],
    [
      "建立统一的输入标准",
      `低质量输入很难换来稳定结果。可以为常见任务准备固定模板，要求写明背景、受众、时间范围、参考资料与输出格式。模板不是限制创造力，而是把重复沟通变成可复用规则，把注意力留给真正需要判断的部分。`,
    ],
    [
      "让检查成为流程的一部分",
      `AI 生成结果不能直接等同于最终答案。事实、数据、引用和平台规则都需要再次确认。更稳妥的方式是设置检查清单：来源能否打开、核心数字能否复算、观点是否有证据、标题是否准确，以及敏感表达是否需要调整。`,
    ],
    [
      "从一个最小工作流开始",
      `第一版不必追求复杂。选择一个每周都会重复、耗时明确、结果容易判断的任务，先完成最短闭环。连续运行几次后，再根据失败记录增加规则。可持续的小流程，通常比一次搭建庞大系统更有价值。`,
    ],
    [
      "用数据评估真实收益",
      `评估效率不能只看生成速度，还要记录人工修改时间、错误数量、采用率和最终效果。如果生成很快却需要大量返工，它并没有真正节省成本。只有把时间、质量和稳定性放在一起比较，才能知道流程是否值得保留。`,
    ],
    [
      "常见误区与修正方法",
      `最常见的误区包括同时接入太多工具、没有保留原始来源、把提示词当作唯一资产，以及忽略人工确认。修正方法是减少变量、保留过程记录、优先沉淀模板与检查表，并为关键步骤设置明确的人工审批点。`,
    ],
    [
      "一周落地计划",
      `第一天选择任务并记录当前耗时；第二天整理输入模板；第三天设计执行步骤；第四天加入质量检查；第五天完整运行一次；周末复盘失败原因并调整规则。经过一轮真实使用，就能得到比单纯收藏工具更可靠的答案。`,
    ],
    [
      "面向不同平台做二次适配",
      `公众号适合保留完整逻辑、案例和方法论，小红书则需要更快进入结论，并把步骤拆成容易浏览和收藏的卡片。平台版本可以共享事实与核心观点，但标题、开场、段落长度和行动引导不应简单复制。`,
    ],
    [
      "把经验沉淀成团队资产",
      `每次运行后都应保存有效模板、失败样例、核验记录和修改原因。长期价值并不只来自某一次生成，而来自一套越来越了解业务边界的工作系统。当新成员加入时，这些资产也能显著降低沟通和培训成本。`,
    ],
    [
      "明确自动化的风险边界",
      `并非所有步骤都适合自动完成。涉及对外承诺、账号权限、资金、隐私和重要事实判断时，应保留人工确认。边界提前写进流程，比出现问题后再补救更可靠，也能避免团队因为追求速度而忽略责任归属。`,
    ],
    [
      "设计清晰的协作机制",
      `当多人共同使用同一流程时，需要约定材料由谁提供、异常由谁处理、最终结果由谁批准。清晰的协作机制可以减少重复劳动，也能让每次修改都有记录，避免不同成员各自维护一套互不兼容的方法。`,
    ],
    [
      "持续复盘而不是一次定型",
      `工作流不会在第一次运行时就达到最佳状态。每次复盘只解决最影响质量的一个问题，并观察下一轮是否改善。通过小步调整积累可靠规则，系统才能逐渐稳定，同时保留对新工具和新业务变化的适应能力。`,
    ],
  ];
  const conclusionHeading = "结语：让方法真正运转起来",
    conclusionText = `围绕“${title}”，最重要的不是一次生成多少内容，而是能否形成稳定、可检查、可持续改进的工作方式。先选择一个真实任务完成闭环，再逐步增加角色、规则和自动化程度。只要结果可以验证、问题能够复盘，这套方法就会随着使用不断变得可靠。`;
  const conclusionCount = countArticleChars(
      `${conclusionHeading}${conclusionText}`,
    ),
    blocks: Array<{ heading?: string; text: string }> = [];
  let current = countArticleChars(`${title}${lead}`),
    index = 0,
    round = 1;
  if (config.requirements.trim()) {
    const requirement = `本文还会重点回应这项要求：${config.requirements.trim()}`;
    if (
      current + countArticleChars(`补充要求${requirement}`) + conclusionCount <=
      max
    ) {
      blocks.push({ heading: "补充要求", text: requirement });
      current += countArticleChars(`补充要求${requirement}`);
    }
  }
  const addCompleteSentences = (
    heading: string | undefined,
    text: string,
    available: number,
  ) => {
    const sentences = text.match(/[^。！？]+[。！？]/g) || [];
    let selected = "";
    for (const sentence of sentences) {
      if (countArticleChars(selected + sentence) > available) break;
      selected += sentence;
      if (
        current +
          countArticleChars(heading || "") +
          countArticleChars(selected) +
          conclusionCount >=
        target
      )
        break;
    }
    if (!selected) return false;
    blocks.push({ heading, text: selected });
    current += countArticleChars(`${heading || ""}${selected}`);
    return true;
  };
  while (current + conclusionCount < target && index < 80) {
    const [baseHeading, baseText] = units[index % units.length];
    const heading =
      index % 2 === 0
        ? round === 1
          ? baseHeading
          : `进阶实践 ${round - 1}：${baseHeading}`
        : undefined;
    const text =
      round === 1
        ? baseText
        : `完成基础搭建后，可以再次围绕“${title}”审视这一环节。${baseText}这一轮需要重点记录变化前后的时间、质量和异常情况，用真实结果决定是否继续保留这项调整。`;
    const fullCount = countArticleChars(`${heading || ""}${text}`),
      available = max - current - conclusionCount;
    if (fullCount <= available) {
      blocks.push({ heading, text });
      current += fullCount;
    } else if (
      !addCompleteSentences(
        heading,
        text,
        Math.max(0, available - countArticleChars(heading || "")),
      )
    )
      break;
    index++;
    if (index % units.length === 0) round++;
  }
  const bridgeSentences = [
    "把负责人、完成时间和检查结果写进记录，下一轮复盘才有可靠依据。",
    "如果某个步骤持续需要大量返工，就应回到输入标准和完成条件重新检查。",
    "流程稳定之后再增加自动化程度，可以显著降低错误被连续放大的风险。",
    "所有对外内容在发布前都应完成事实核验、语言检查和账号确认。",
  ];
  for (const sentence of bridgeSentences) {
    if (current + conclusionCount >= min) break;
    if (current + countArticleChars(sentence) + conclusionCount <= max) {
      blocks.push({ text: sentence });
      current += countArticleChars(sentence);
    }
  }
  blocks.push({ heading: conclusionHeading, text: conclusionText });
  current += conclusionCount;
  return { lead, blocks, actual: current, target, min, max };
}
function ArticlePreview({
  go,
  config,
  generatedContent,
}: {
  go: (p: Page) => void;
  config: PreviewConfig;
  generatedContent: GeneratedContent;
}) {
  const platformText = config.platforms
      .map((x) => (x === "wechat" ? "公众号" : "小红书"))
      .join(" + "),
    article = generatedContent.article;
  const imageUrls = (generatedContent.content?.mediaAssets || [])
    .map((asset: any) => asset.localUrl || asset.sourceUrl)
    .filter(Boolean);
  const imagePositions = new Map<number, number[]>();
  for (let i = 0; i < imageUrls.length; i++) {
    const at = Math.max(
      0,
      Math.min(
        article.blocks.length - 1,
        Math.floor(((i + 1) * article.blocks.length) / (config.images + 1)),
      ),
    );
    imagePositions.set(at, [...(imagePositions.get(at) || []), i]);
  }
  return (
    <div className="article-preview">
      <div className="editor-bar">
        <div>
          <span className="status done">
            <Check size={12} />
            生成完成
          </span>
          <small>
            实际 {article.actualLength} 字 / 目标 {config.length} · {imageUrls.length}{" "}
            张配图 · {platformText}
          </small>
        </div>
        <div>
          <button className="secondary">
            <Eye size={15} />
            预览
          </button>
          <button className="primary" onClick={() => go("editor")}>
            <Edit3 size={15} />
            进入编辑
          </button>
        </div>
      </div>
      <div className="article-paper">
        <span className="article-label">
          {config.style} · {config.purpose}
        </span>
        <h1>{article.title}</h1>
        <p className="lead">{article.lead}</p>
        {article.blocks.map((block, index) => (
          <div
            className="article-block"
            key={`${index}-${block.heading || "p"}`}
          >
            {block.heading && <h2>{block.heading}</h2>}
            <p>{block.text}</p>
            {(imagePositions.get(index) || []).map((imageIndex) => (
              <img
                key={imageIndex}
                src={imageUrls[imageIndex]}
                alt={`文章配图 ${imageIndex + 1}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function apiContentToRow(content: any): ContentRow {
  const statusLabels: Record<string, string> = {
    draft: "草稿",
    pending_review: "待发布",
    pending_publish: "待发布",
    ready_to_publish: "待发布",
    publishing: "发布中",
    wechat_draft: "草稿箱",
    published: "已发布",
    failed: "发布失败",
    archived: "已归档",
  };
  const versions = Array.isArray(content.versions) ? content.versions : [];
  const wechatVersion = versions.find((version: any) => version.platform === "wechat");
  const latestJob = content.latestPublishJob;
  const status = latestJob?.status === "processing"
    ? "发布中"
    : latestJob?.status === "draft_created"
      ? "草稿箱"
      : latestJob?.status === "failed"
        ? "发布失败"
        : statusLabels[content.status] || "草稿";
  return {
    id: String(content.id),
    versionId: wechatVersion?.id || versions[0]?.id,
    title: content.title,
    desc: content.excerpt || "已生成完整文章",
    platforms: (content.platforms || versions.map((version: any) => version.platform))
      .map((platform: string) => platform === "wechat" ? "公众号" : "小红书"),
    status,
    time: contentTime(content.createdAt),
    daysAgo: contentDaysAgo(content.createdAt),
    tone: "violet",
    createdAt: content.createdAt,
    body: content.body,
    images: (content.mediaAssets || [])
      .map((asset: any) => asset.localUrl || asset.sourceUrl)
      .filter(Boolean),
    externalId: latestJob?.externalId || undefined,
    externalUrl: latestJob?.externalUrl || undefined,
    resultMessage: latestJob?.responsePayload?.message || undefined,
    errorMessage: latestJob?.errorMessage || undefined,
  };
}

function Publish({ go }: { go: (p: Page) => void }) {
  const [publishRows, setPublishRows] = useState(contentRows);
  const [tab, setTab] = useState("全部");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("全部平台");
  const [dateRange, setDateRange] = useState("30");
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState("");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [resultRow, setResultRow] = useState<any>(null);
  const [publishPlatforms, setPublishPlatforms] = useState<string[]>([]);
  const [publishMode, setPublishMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [integration, setIntegration] = useState<any>({
    wechatPublishing: false,
    xiaohongshuPublishing: false,
  });
  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((r) => r.ok && setIntegration(r.data))
      .catch(() => {});
  }, []);
  const loadPublishRows = async () => {
    await fetch("/api/publish-jobs", { cache: "no-store" }).catch(() => null);
    const response = await fetch("/api/contents", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error?.message || "读取内容库失败");
    const items = Array.isArray(result.data) ? result.data : [];
    setPublishRows(items.map(apiContentToRow));
    return items;
  };
  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        let items = await loadPublishRows();
        const migrationKey = "content-factory:sqlite-migration-v1";
        if (!localStorage.getItem(migrationKey)) {
          localStorage.setItem(migrationKey, "running");
          try {
            const legacyRows = JSON.parse(localStorage.getItem("content-factory:publish-rows-v2") || "[]");
            const existingTitles = new Set(items.map((item: any) => item.title));
            const importable = (Array.isArray(legacyRows) ? legacyRows : []).filter(
              (row: any) => row?.title && row?.body?.replace(/\s/g, "").length >= 300 && !existingTitles.has(row.title),
            );
            for (const row of importable) {
              await fetch("/api/contents", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  title: row.title,
                  excerpt: row.desc || "从本机旧版本迁移的文章",
                  body: row.body,
                  status: ["草稿箱", "已发布"].includes(row.status) ? "draft" : "ready_to_publish",
                  platforms: (row.platforms || ["公众号"]).map((platform: string) => platform === "公众号" ? "wechat" : "xiaohongshu"),
                  mediaAssets: (row.images || []).map((sourceUrl: string) => ({ source: "legacy", sourceUrl })),
                }),
              });
            }
            localStorage.setItem(migrationKey, "done");
            if (importable.length) items = await loadPublishRows();
          } catch {
            localStorage.removeItem(migrationKey);
          }
        }
      } catch (error) {
        if (!cancelled) act(error instanceof Error ? error.message : "读取内容库失败");
      }
    };
    initialize();
    const timer = window.setInterval(() => loadPublishRows().catch(() => {}), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  const counts: any = {
    全部: publishRows.length,
    草稿: publishRows.filter((x) => x.status === "草稿").length,
    待发布: publishRows.filter((x) => x.status === "待发布").length,
    发布中: publishRows.filter((x) => x.status === "发布中").length,
    草稿箱: publishRows.filter((x) => x.status === "草稿箱").length,
    已发布: publishRows.filter((x) => x.status === "已发布").length,
    发布失败: publishRows.filter((x) => x.status === "发布失败").length,
  };
  const visibleTabs = [
    "全部",
    "草稿",
    "待发布",
    "发布中",
    "草稿箱",
    "已发布",
    "发布失败",
  ];
  const filtered = publishRows.filter(
    (x) =>
      (tab === "全部" || x.status === tab) &&
      (platformFilter === "全部平台" || x.platforms.includes(platformFilter)) &&
      x.daysAgo <= Number(dateRange) &&
      (x.title.includes(query) || x.desc.includes(query)),
  );
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [tab, query, platformFilter, dateRange]);
  const act = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const openPublish = (row: any) => {
    setSelectedRow(row);
    const connectedPlatforms = row.platforms.filter((platform: string) =>
      platform === "公众号"
        ? integration.wechatPublishing
        : integration.xiaohongshuPublishing,
    );
    setPublishPlatforms(connectedPlatforms.length ? connectedPlatforms : row.platforms);
    setPublishMode("now");
    setScheduledAt("");
    setMenu("");
  };
  const channelConnected = (name: string) =>
    name === "公众号"
      ? integration.wechatPublishing
      : integration.xiaohongshuPublishing;
  const wechatAccountName =
    integration?.publishingConnections?.wechat?.accountName || "未配置公众号";
  const xhsAccountName =
    integration?.publishingConnections?.xiaohongshu?.accountName || "未配置小红书账号";
  const allConnected =
    publishPlatforms.length > 0 && publishPlatforms.every(channelConnected);
  const confirmPublish = async () => {
    if (!allConnected) return;
    if (!publishPlatforms.includes("公众号")) {
      act("当前只接通了公众号草稿箱，请先选择公众号");
      return;
    }
    if (publishPlatforms.includes("小红书")) {
      act("小红书真实发布尚未接通，请先取消勾选小红书");
      return;
    }
    let prepared: any = null;
    if (selectedRow.body) {
      prepared = {
        contentId: selectedRow.id,
        contentVersionId: selectedRow.versionId,
        title: selectedRow.title,
        digest: selectedRow.desc,
        body: selectedRow.body,
        images: selectedRow.images || [],
        mediaId: selectedRow.externalId,
      };
    }
    if (!prepared) {
      act("找不到这篇文章的完整正文，请先进入编辑页生成并保存后再提交草稿箱");
      return;
    }
    const publishingRow = selectedRow;
    setSubmitting(true);
    setPublishRows((current) =>
      current.map((row) =>
        row.id === publishingRow.id
          ? {
              ...row,
              status: "发布中",
              time: "刚刚",
              resultMessage: "正在上传封面和正文，并等待微信草稿箱回查结果。",
            }
          : row,
      ),
    );
    try {
      const response = await fetch("/api/integrations/wechat/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prepared),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error?.message || "创建公众号草稿失败");
      }
      const completedRow = {
        ...publishingRow,
        status: "草稿箱",
        time: "刚刚",
        externalId: result.data.mediaId,
        externalUrl: result.data.backendUrl,
        resultMessage: result.data.message,
        errorMessage: undefined,
      };
      await loadPublishRows();
      setSelectedRow(null);
      setResultRow(completedRow);
      act("已存入微信公众号草稿箱并完成回查");
    } catch (error) {
      const failedRow = {
        ...publishingRow,
        status: "发布失败",
        time: "刚刚",
        errorMessage: error instanceof Error ? error.message : "创建公众号草稿失败",
      };
      setPublishRows((current) =>
        current.map((row) => row.id === publishingRow.id ? failedRow : row),
      );
      setSelectedRow(null);
      setResultRow(failedRow);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>发布管理</h2>
          <p>只有收到平台成功回执的内容才会显示为“已发布”</p>
        </div>
        <button className="primary" onClick={() => go("create")}>
          <Plus size={17} />
          创建文章
        </button>
      </div>
      <div className="publish-tabs">
        {visibleTabs.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
            <span>{counts[x]}</span>
          </button>
        ))}
      </div>
      <div className="card table-card">
        <div className="toolbar">
          <div className="inline-search">
            <Search size={16} />
            <input
              placeholder="搜索标题或关键词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="select-filter">
            <Filter size={16} />
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="筛选平台"
            >
              <option>全部平台</option>
              <option>公众号</option>
              <option>小红书</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="select-filter">
            <Clock3 size={16} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="筛选更新时间"
            >
              <option value="1">最近 24 小时</option>
              <option value="7">最近 7 天</option>
              <option value="30">最近 30 天</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <div className="publish-destination-note">
          <Send size={14} />
          <span>
            发布目标账号：公众号「{wechatAccountName}」 · 小红书「{xhsAccountName}」
          </span>
          <button onClick={() => go("settings")}>管理连接</button>
        </div>
        <div className="content-list-head">
          <span>内容</span>
          <span>平台版本</span>
          <span>状态</span>
          <span>创建时间</span>
          <span>操作</span>
        </div>
        {rows.map((r) => (
          <div className="content-row" key={r.title}>
            <div className="content-info">
              <div className={`cover ${r.tone}`}>
                <Sparkles size={20} />
              </div>
              <div>
                <b onClick={() => go("editor")}>{r.title}</b>
                <p>{r.desc}</p>
              </div>
            </div>
            <div className="platform-badges">
              {r.platforms.map((p) => (
                <span className={p === "公众号" ? "wc" : "red"} key={p}>
                  {p === "公众号" ? "微" : "小"}
                  <i>{p}</i>
                </span>
              ))}
            </div>
            <div>
              <span
                className={`status ${r.status === "发布失败" ? "failed" : ["已发布", "草稿箱"].includes(r.status) ? "done" : r.status === "发布中" ? "processing" : "blue"}`}
              >
                {r.status}
              </span>
            </div>
            <time>{r.time}</time>
            <div className="row-actions">
              <button className="plain" onClick={() => go("editor")}>
                <Edit3 size={15} />
                编辑
              </button>
              {r.status === "待发布" && (
                <button className="primary tiny" onClick={() => openPublish(r)}>
                  <Send size={13} />
                  发布
                </button>
              )}
              {r.status === "发布失败" && (
                <button
                  className="secondary tiny"
                  onClick={() => openPublish(r)}
                >
                  重试
                </button>
              )}
              {r.status === "草稿箱" && (
                <button
                  className="secondary tiny"
                  onClick={() => openPublish(r)}
                >
                  重新同步图文
                </button>
              )}
              {r.status === "草稿箱" && (
                <button
                  className="primary tiny"
                  onClick={() =>
                    window.open(
                      wechatBackendUrl,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  去公众号发布
                </button>
              )}
              {["发布中", "草稿箱", "已发布", "发布失败"].includes(r.status) && (
                <button
                  className="secondary tiny"
                  onClick={() => setResultRow(r)}
                >
                  {r.status === "发布失败" ? "失败详情" : "查看结果"}
                </button>
              )}
              <div className="more-wrap">
                <button
                  className="icon-btn"
                  aria-label="更多操作"
                  aria-expanded={menu === r.title}
                  onClick={() => setMenu(menu === r.title ? "" : r.title)}
                >
                  <MoreHorizontal size={17} />
                </button>
                {menu === r.title && (
                  <div className="row-menu">
                    <button onClick={() => go("editor")}>
                      <Eye size={14} />
                      查看内容
                    </button>
                    <button
                      onClick={() => {
                        setMenu("");
                        act("已复制一份到草稿");
                      }}
                    >
                      <Copy size={14} />
                      复制为草稿
                    </button>
                    {["待发布", "发布失败"].includes(r.status) && (
                      <button onClick={() => openPublish(r)}>
                        <Settings size={14} />
                        发布设置
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="empty-row">没有符合当前筛选条件的内容</div>
        )}
        <div className="pagination">
          <span>共 {filtered.length} 篇内容</span>
          <div>
            <button
              disabled={page === 1}
              onClick={() => setPage((x) => Math.max(1, x - 1))}
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((x) => (
              <button
                className={page === x ? "selected" : ""}
                onClick={() => setPage(x)}
                key={x}
              >
                {x}
              </button>
            ))}
            <button
              disabled={page === pageCount}
              onClick={() => setPage((x) => Math.min(pageCount, x + 1))}
            >
              ›
            </button>
          </div>
        </div>
      </div>
      {selectedRow && (
        <div
          className="modal-wrap"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSelectedRow(null)
          }
        >
          <section className="publish-confirm-modal">
            <button
              className="publish-modal-close"
              aria-label="关闭"
              onClick={() => setSelectedRow(null)}
            >
              <X size={17} />
            </button>
            <div className="publish-modal-heading">
              <div className="publish-modal-icon">
                <Send size={19} />
              </div>
              <div>
                <h3>
                  {selectedRow.status === "发布失败" ? "重新创建草稿" : "暂存公众号草稿"}
                </h3>
                <p>{selectedRow.title}</p>
              </div>
            </div>
            <div className="publish-step">
              <label>1. 选择发布账号</label>
              <div className="publish-channel-list">
                {selectedRow.platforms.map((p: string) => {
                  const active = publishPlatforms.includes(p),
                    connected = channelConnected(p);
                  return (
                    <button
                      key={p}
                      className={active ? "active" : ""}
                      onClick={() =>
                        setPublishPlatforms((current) =>
                          active
                            ? current.filter((x) => x !== p)
                            : [...current, p],
                        )
                      }
                    >
                      <span
                        className={p === "公众号" ? "wechat big" : "xhs big"}
                      >
                        {p === "公众号" ? "微" : "小"}
                      </span>
                      <p>
                        <b>
                          {p === "公众号"
                            ? `微信公众号 · ${wechatAccountName}`
                            : `小红书 · ${xhsAccountName}`}
                        </b>
                        <small
                          className={connected ? "connected" : "disconnected"}
                        >
                          {connected ? "接口已连接" : "发布接口未连接"}
                        </small>
                      </p>
                      {active ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <span className="platform-empty" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="publish-step">
              <label>2. 选择发布方式</label>
              <div className="publish-mode">
                <button
                  className="active"
                  onClick={() => setPublishMode("now")}
                >
                  暂存到公众号草稿箱
                </button>
                <button
                  disabled
                  title="当前公众号没有接口直接群发权限"
                >
                  接口直接发布（无权限）
                </button>
              </div>
              <small>草稿创建并回查成功后，可点击“去公众号发布”进入微信后台确认群发。</small>
            </div>
            {!allConnected && (
              <div className="publish-warning">
                <CircleAlert size={16} />
                <div>
                  <b>当前无法真正发布</b>
                  <span>
                    所选平台接口尚未配置。连接后，文章会发布到上面标明的账号。
                  </span>
                </div>
              </div>
            )}
            <div className="publish-modal-actions">
              <button
                className="secondary"
                onClick={() => setSelectedRow(null)}
              >
                取消
              </button>
              {allConnected ? (
                <button className="primary" onClick={confirmPublish} disabled={submitting}>
                  {submitting ? "正在创建并回查草稿…" : "确认暂存草稿箱"}
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => {
                    setSelectedRow(null);
                    go("settings");
                  }}
                >
                  去系统设置连接
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {resultRow && (
        <div
          className="modal-wrap"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setResultRow(null)
          }
        >
          <section className="publish-result-modal">
            <button
              className="publish-modal-close"
              aria-label="关闭"
              onClick={() => setResultRow(null)}
            >
              <X size={17} />
            </button>
            <div
              className={`publish-result-heading ${resultRow.status === "发布失败" ? "failed" : ["已发布", "草稿箱"].includes(resultRow.status) ? "success" : "running"}`}
            >
              {["已发布", "草稿箱"].includes(resultRow.status) ? (
                <CheckCircle2 size={23} />
              ) : resultRow.status === "发布失败" ? (
                <CircleAlert size={23} />
              ) : (
                <LoaderCircle className="spin" size={23} />
              )}
              <div>
                <h3>发布结果</h3>
                <p>{resultRow.title}</p>
              </div>
            </div>
            <dl className="publish-result-list">
              <div>
                <dt>当前状态</dt>
                <dd>{resultRow.status}</dd>
              </div>
              <div>
                <dt>目标平台</dt>
                <dd>{resultRow.platforms.join("、")}</dd>
              </div>
              <div>
                <dt>最后更新</dt>
                <dd>{resultRow.time}</dd>
              </div>
              <div>
                <dt>平台回执</dt>
                <dd>
                  {resultRow.errorMessage ||
                    resultRow.resultMessage ||
                    "暂无平台回执"}
                </dd>
              </div>
            </dl>
            {resultRow.status === "已发布" && resultRow.externalUrl && (
              <a
                className="primary publish-result-link"
                href={resultRow.externalUrl}
                target="_blank"
                rel="noreferrer"
              >
                打开已发布文章 <ExternalLink size={14} />
              </a>
            )}
            {resultRow.status === "草稿箱" && resultRow.externalUrl && (
              <a
                className="primary publish-result-link"
                href={wechatBackendUrl}
                target="_blank"
                rel="noreferrer"
              >
                打开公众号后台并发布 <ExternalLink size={14} />
              </a>
            )}
            {!["已发布", "草稿箱"].includes(resultRow.status) && (
              <div className="publish-result-note">
                未收到平台成功回执，因此不会显示为“已发布”。
              </div>
            )}
            <button
              className="secondary full"
              onClick={() => setResultRow(null)}
            >
              关闭
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}

function Editor({ go }: { go: (p: Page) => void }) {
  const [version, setVersion] = useState("母稿");
  const [saved, setSaved] = useState(false);
  const [publish, setPublish] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [publishingAccounts, setPublishingAccounts] = useState({
    wechat: "未配置公众号",
    xiaohongshu: "未配置小红书账号",
  });
  useEffect(() => {
    fetch("/api/contents", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        const content = result.ok && Array.isArray(result.data) ? result.data[0] : null;
        if (!content) return;
        const parsed = parseArticleMarkdown(content.body || "");
        const article = {
          title: content.title,
          excerpt: content.excerpt,
          imageQuery: "",
          lead: parsed.lead,
          blocks: parsed.blocks,
        };
        setDraft({
          contentId: content.id,
          body: content.body,
          config: {
            topic: { title: content.title },
            style: content.styleSelection?.writing || "专业易懂",
            purpose: content.styleSelection?.purpose || "知识分享",
            images: content.mediaAssets?.length || 0,
          },
          article: {
            ...article,
            actual: countArticleCharacters(article),
          },
          images: (content.mediaAssets || []).map((asset: any) => asset.localUrl || asset.sourceUrl).filter(Boolean),
        });
      })
      .catch(() => {});
    fetch("/api/integrations/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) return;
        setPublishingAccounts({
          wechat:
            result.data?.publishingConnections?.wechat?.accountName ||
            "未配置公众号",
          xiaohongshu:
            result.data?.publishingConnections?.xiaohongshu?.accountName ||
            "未配置小红书账号",
        });
      })
      .catch(() => {});
  }, []);
  const saveDraft = async () => {
    if (!draft?.contentId) return;
    const response = await fetch(`/api/contents/${draft.contentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draft.config.topic.title,
        body: draft.body,
        status: "ready_to_publish",
      }),
    });
    setSaved(response.ok);
  };
  const draftTitle =
      draft?.config?.topic?.title || "普通人如何搭建自己的第一支 AI 数字团队",
    draftLength = Number(draft?.article?.actual || 1826),
    draftImages = Number(draft?.config?.images || 3);
  const editorImagePositions = new Map<number, number[]>();
  if (draft?.article?.blocks)
    for (let i = 0; i < draftImages; i++) {
      const at = Math.max(
        0,
        Math.min(
          draft.article.blocks.length - 1,
          Math.floor(
            ((i + 1) * draft.article.blocks.length) / (draftImages + 1),
          ),
        ),
      );
      editorImagePositions.set(at, [
        ...(editorImagePositions.get(at) || []),
        i,
      ]);
    }
  return (
    <>
      <div className="editor-top">
        <button className="back" onClick={() => go("publish")}>
          <ArrowLeft size={16} />
          返回发布管理
        </button>
        <div className="editor-actions">
          <span>{saved ? "刚刚已保存" : "上次保存于 10:42"}</span>
          <button className="secondary">
            <Eye size={16} />
            预览
          </button>
          <button className="secondary" onClick={saveDraft}>
            <Check size={16} />
            保存
          </button>
          <button className="primary" onClick={() => setPublish(true)}>
            <Send size={16} />
            准备发布
          </button>
        </div>
      </div>
      <div className="edit-layout">
        <aside className="version-panel card">
          <span className="aside-label">内容版本</span>
          {[
            ["母稿", `原始长文 · ${draftLength} 字`, FileText],
            ["公众号", `长文 · ${draftLength} 字`, BookOpen],
            ["小红书", `待生成平台精简版`, ImageIcon],
          ].map(([t, d, I]: any) => (
            <button
              key={t}
              className={version === t ? "active" : ""}
              onClick={() => setVersion(t)}
            >
              <I size={18} />
              <p>
                <b>{t}</b>
                <span>{d}</span>
              </p>
              {version === t && <CheckCircle2 size={16} />}
            </button>
          ))}
          <hr />
          <button className="add-version">
            <Plus size={16} />
            生成平台版本
          </button>
          <div className="version-note">
            <Sparkles size={15} />
            <p>平台版本会继承母稿内容，并根据平台特点自动改写。</p>
          </div>
        </aside>
        <main className="document-editor card">
          <div className="format-bar">
            <select>
              <option>正文</option>
            </select>
            <button>
              <b>B</b>
            </button>
            <button>
              <i>I</i>
            </button>
            <button>U</button>
            <i />
            <button>☷</button>
            <button>≡</button>
            <button>
              <ImageIcon size={16} />
            </button>
            <button>
              <span>↗</span>
            </button>
            <div className="autosave">自动保存已开启</div>
          </div>
          <article contentEditable suppressContentEditableWarning>
            <div className="doc-category">
              {draft?.config
                ? `${draft.config.style} · ${draft.config.purpose}`
                : "效率方法 · AI 实战"}
            </div>
            <h1>{draftTitle}</h1>
            {draft ? (
              <>
                <p className="doc-lead">{draft.article.lead}</p>
                {draft.article.blocks.map((block: any, index: number) => (
                  <div key={index}>
                    {block.heading && <h2>{block.heading}</h2>}
                    <p>{block.text}</p>
                    {(editorImagePositions.get(index) || []).map(
                      (imageIndex) => (
                        <img
                          key={imageIndex}
                          src={
                            draft.images[imageIndex]
                          }
                          alt={`文章配图 ${imageIndex + 1}`}
                        />
                      ),
                    )}
                  </div>
                ))}
              </>
            ) : (
              <>
                <p className="doc-lead">
                  真正有价值的 AI，不是陪你聊天，而是替你把事情做完。
                </p>
                <img src={previewImageUrls[0]} alt="AI visual" />
                <p>
                  过去一年，我们收藏了无数 AI 工具，却依然被重复工作填满日程。
                </p>
                <h2>从一个任务，而不是一个工具开始</h2>
                <p>
                  搭建数字团队的第一步，是找到那些高频、规则明确、结果可以检查的工作。
                </p>
              </>
            )}
          </article>
        </main>
        <aside className="publish-panel card">
          <span className="aside-label">发布设置</span>
          <div className="form-section">
            <label>内容状态</label>
            <select className="input">
              <option>草稿</option>
              <option>待发布</option>
            </select>
          </div>
          <div className="form-section">
            <label>发布渠道</label>
            <label className="channel-check">
              <span className="wechat">微</span>
              <p>
                <b>微信公众号</b>
                <small>{publishingAccounts.wechat}</small>
              </p>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="channel-check">
              <span className="xhs">小</span>
              <p>
                <b>小红书</b>
                <small>{publishingAccounts.xiaohongshu}</small>
              </p>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
          <div className="form-section">
            <label>发布时间</label>
            <div className="chip-group">
              <button className="active">立即发布</button>
              <button>定时发布</button>
            </div>
          </div>
          <hr />
          <div className="quality">
            <div>
              <span>内容完整度</span>
              <b>92%</b>
            </div>
            <div className="progress">
              <i style={{ width: "92%" }} />
            </div>
            <p>
              <Check size={13} />
              实际正文约 {draftLength} 字
            </p>
            <p>
              <Check size={13} />
              正文已插入 {draftImages} 张图片
            </p>
            <p>
              <Check size={13} />
              已生成平台母稿
            </p>
          </div>
        </aside>
      </div>
      {publish && (
        <div className="modal-wrap">
          <div className="modal">
            <div className="success-circle">
              <Check size={25} />
            </div>
            <h3>已加入待发布列表</h3>
            <p>无需审核，可在发布管理中直接选择渠道发布。</p>
            <button
              className="primary full"
              onClick={() => {
                setPublish(false);
                go("publish");
              }}
            >
              返回发布管理
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsPage() {
  const [section, setSection] = useState("AI 模型");
  const [toast, setToast] = useState("");
  const [connectionModal, setConnectionModal] = useState<
    "wechat" | "xiaohongshu" | null
  >(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionForm, setConnectionForm] = useState({
    accountName: "",
    apiUrl: "",
    apiKey: "",
  });
  const items = [
    ["AI 模型", Bot],
    ["内容采集 API", Cloud],
    ["发布渠道", Send],
    ["Unsplash 图片", ImageIcon],
    ["通用设置", Settings],
  ];
  const loadConnections = async (showMessage = false) => {
    setChecking(true);
    try {
      const r = await fetch("/api/integrations/status", { cache: "no-store" }),
        x = await r.json();
      if (!r.ok || !x.ok) throw new Error();
      setConnectionStatus(x.data);
      if (showMessage) {
        setToast("连接状态已重新检测");
        setTimeout(() => setToast(""), 2200);
      }
    } catch {
      setToast("连接状态检测失败，请确认本地服务");
      setTimeout(() => setToast(""), 2400);
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    loadConnections();
  }, []);
  const openConnection = async (platform: "wechat" | "xiaohongshu") => {
    setConnectionModal(platform);
    setConnectionForm({
      accountName:
        connectionStatus?.publishingConnections?.[platform]?.accountName || "",
      apiUrl: "",
      apiKey: "",
    });
    try {
      const r = await fetch(
          `/api/integrations/connections?platform=${platform}`,
          { cache: "no-store" },
        ),
        x = await r.json();
      if (r.ok && x.ok && x.data)
        setConnectionForm({
          accountName: x.data.accountName || "",
          apiUrl: x.data.apiUrl || "",
          apiKey: "",
        });
    } catch {}
    loadConnections();
  };
  const saveConnection = async () => {
    if (!connectionModal) return;
    setSavingConnection(true);
    try {
      const r = await fetch("/api/integrations/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: connectionModal,
            ...connectionForm,
          }),
        }),
        x = await r.json();
      if (!r.ok || !x.ok) throw new Error(x.error?.message || "保存失败");
      setToast("发布连接配置已安全保存");
      await loadConnections();
      setConnectionForm((form) => ({ ...form, apiKey: "" }));
      setTimeout(() => setToast(""), 2200);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "保存失败，请检查填写内容",
      );
      setTimeout(() => setToast(""), 3000);
    } finally {
      setSavingConnection(false);
    }
  };
  const testAiConnection = async () => {
    setAiTesting(true);
    try {
      const response = await fetch("/api/integrations/ai/test", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.data?.connected)
        throw new Error(result.error?.message || "连接测试失败");
      setToast("本机 Codex 连接测试成功");
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "本机 Codex 连接测试失败",
      );
    } finally {
      setAiTesting(false);
      setTimeout(() => setToast(""), 3000);
    }
  };
  const modalInfo =
    connectionModal === "wechat"
      ? {
          name: "微信公众号",
          account:
            connectionStatus?.publishingConnections?.wechat?.accountName ||
            "未配置公众号",
          status: connectionStatus?.publishingConnections?.wechat,
        }
      : connectionModal === "xiaohongshu"
          ? {
              name: "小红书",
              account:
                connectionStatus?.publishingConnections?.xiaohongshu
                  ?.accountName || "未配置小红书账号",
              status: connectionStatus?.publishingConnections?.xiaohongshu,
            }
        : null;
  const wechatConnected = Boolean(connectionStatus?.wechatPublishing),
    xhsConnected = Boolean(connectionStatus?.xiaohongshuPublishing);
  const wechatAccountName =
    connectionStatus?.publishingConnections?.wechat?.accountName ||
    "未配置公众号";
  const xhsAccountName =
    connectionStatus?.publishingConnections?.xiaohongshu?.accountName ||
    "未配置小红书账号";
  const codexProvider = connectionStatus?.aiProvider === "codex-cli";
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>系统设置</h2>
          <p>管理模型、数据源与内容发布渠道</p>
        </div>
      </div>
      <div className="settings-layout">
        <aside className="settings-nav card">
          {items.map(([t, I]: any) => (
            <button
              className={section === t ? "active" : ""}
              onClick={() => setSection(t)}
              key={t}
            >
              <I size={17} />
              {t}
              <ChevronRight size={15} />
            </button>
          ))}
        </aside>
        <main className="settings-main card">
          <div className="settings-head">
            <div>
              <h3>{section}</h3>
              <p>
                {section === "AI 模型"
                  ? "配置用于摘要、洞察和内容创作的 OpenAI 兼容接口"
                  : section === "发布渠道"
                    ? "连接你的内容平台账号"
                    : "配置服务连接和默认参数"}
              </p>
            </div>
          </div>
          {section === "AI 模型" ? (
            <>
              <div className="connected-box">
                <div className="model-logo">
                  <Bot size={20} />
                </div>
                <div>
                  <b>
                    {codexProvider
                      ? "本机 Codex（当前 ChatGPT 账号）"
                      : "OpenAI Compatible"}
                  </b>
                  <span>
                    当前状态：{connectionStatus?.ai ? "已配置" : "未配置"}
                  </span>
                </div>
                <span
                  className={`status ${connectionStatus?.ai ? "done" : "failed"}`}
                >
                  {connectionStatus?.ai ? (
                    <>
                      <Check size={12} />
                      {codexProvider ? "已登录" : "已连接"}
                    </>
                  ) : (
                    <>
                      <CircleAlert size={12} />
                      未连接
                    </>
                  )}
                </span>
              </div>
              <div className="form-section">
                <label>接口地址</label>
                <input
                  className="input"
                  value={
                    codexProvider ? "本机 Codex CLI（无需接口地址）" : undefined
                  }
                  readOnly={codexProvider}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="form-section">
                <label>API Key</label>
                <div className="secret-input">
                  <input
                    className="input"
                    type="password"
                    value={
                      codexProvider
                        ? "使用当前 Codex 登录，无需 API Key"
                        : undefined
                    }
                    readOnly={codexProvider}
                    placeholder="请输入服务端 API Key"
                  />
                  <button>
                    <Eye size={16} />
                  </button>
                </div>
                <small>
                  {codexProvider
                    ? "仅限当前电脑本地使用；部署云端时需要独立 API Key"
                    : "页面不会展示服务端已经保存的密钥"}
                </small>
              </div>
              <div className="form-row">
                <div className="form-section">
                  <label>默认分析模型</label>
                  <select className="input" disabled={codexProvider}>
                    <option>
                      {connectionStatus?.aiModel || "gpt-5.6-sol"}
                    </option>
                    <option>gpt-5</option>
                    <option>gpt-4.1</option>
                  </select>
                </div>
                <div className="form-section">
                  <label>默认创作模型</label>
                  <select className="input" disabled={codexProvider}>
                    <option>
                      {connectionStatus?.aiModel || "gpt-5.6-sol"}
                    </option>
                    <option>gpt-5</option>
                    <option>gpt-4.1</option>
                  </select>
                </div>
              </div>
              <div className="test-row">
                <button
                  className="secondary"
                  onClick={testAiConnection}
                  disabled={aiTesting}
                >
                  <Activity size={15} />
                  {aiTesting ? "正在调用 Codex…" : "测试连接"}
                </button>
              </div>
            </>
          ) : section === "发布渠道" ? (
            <div className="connections">
              <div>
                <span className="wechat big">微</span>
                <p>
                  <b>微信公众号</b>
                  <small>
                    {wechatAccountName} ·{" "}
                    {wechatConnected ? "发布连接已配置" : "发布接口未配置"}
                  </small>
                </p>
                <span
                  className={`status ${wechatConnected ? "done" : "failed"}`}
                >
                  {wechatConnected ? "已配置" : "未配置"}
                </span>
                <button
                  className="secondary"
                  onClick={() => openConnection("wechat")}
                >
                  管理连接
                </button>
              </div>
              <div>
                <span className="xhs big">小</span>
                <p>
                  <b>小红书</b>
                  <small>
                    {xhsAccountName} ·{" "}
                    {xhsConnected ? "发布连接已配置" : "发布授权未配置"}
                  </small>
                </p>
                <span className={`status ${xhsConnected ? "done" : "failed"}`}>
                  {xhsConnected ? "已配置" : "未配置"}
                </span>
                <button
                  className="secondary"
                  onClick={() => openConnection("xiaohongshu")}
                >
                  {xhsConnected ? "管理连接" : "重新授权"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="empty-settings">
                <div className="setting-art">
                  <Palette size={28} />
                </div>
                <h3>{section}配置</h3>
                <p>这里将用于管理 {section} 的接口参数和默认行为。</p>
              </div>
            </>
          )}
          <div className="settings-actions">
            <button className="secondary" onClick={() => setToast("")}>
              取消
            </button>
            <button
              className="primary"
              disabled={section === "AI 模型" && codexProvider}
              onClick={() => {
                setToast("页面设置已保存");
                setTimeout(() => setToast(""), 1800);
              }}
            >
              {section === "AI 模型" && codexProvider
                ? "当前配置已生效"
                : "保存设置"}
            </button>
          </div>
        </main>
      </div>
      {connectionModal && modalInfo && (
        <div
          className="modal-wrap"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setConnectionModal(null)
          }
        >
          <section className="connection-config-modal">
            <button
              className="publish-modal-close"
              aria-label="关闭"
              onClick={() => setConnectionModal(null)}
            >
              <X size={17} />
            </button>
            <div className="connection-config-head">
              <span
                className={
                  connectionModal === "wechat" ? "wechat big" : "xhs big"
                }
              >
                {connectionModal === "wechat" ? "微" : "小"}
              </span>
              <div>
                <h3>
                  {connectionModal === "wechat"
                    ? "管理公众号连接"
                    : "重新授权小红书"}
                </h3>
                <p>{modalInfo.account}</p>
              </div>
            </div>
            <div
              className={`connection-state ${modalInfo.status?.connected ? "connected" : "disconnected"}`}
            >
              <span>
                {modalInfo.status?.connected ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <CircleAlert size={17} />
                )}
              </span>
              <div>
                <b>
                  {modalInfo.status?.connected
                    ? "发布连接已配置"
                    : "当前尚未配置"}
                </b>
                <small>
                  {modalInfo.status?.connected
                    ? connectionModal === "wechat"
                      ? "AppID 和 AppSecret 已安全保存"
                      : "接口地址和密钥已保存，发布时将验证接口可用性"
                    : connectionModal === "wechat"
                      ? "需要配置公众号 AppID 和 AppSecret"
                      : "需要同时配置接口地址和访问密钥"}
                </small>
              </div>
            </div>
            <div className="connection-form">
              <label>
                <span>账号名称</span>
                <input
                  className="input"
                  value={connectionForm.accountName}
                  onChange={(event) =>
                    setConnectionForm((form) => ({
                      ...form,
                      accountName: event.target.value,
                    }))
                  }
                  placeholder="用于在发布管理中识别账号"
                />
              </label>
              <label>
                <span>
                  {connectionModal === "wechat"
                    ? "公众号 AppID"
                    : "第三方发布接口地址"}
                </span>
                <input
                  className="input"
                  value={connectionForm.apiUrl}
                  onChange={(event) =>
                    setConnectionForm((form) => ({
                      ...form,
                      apiUrl: event.target.value,
                    }))
                  }
                  placeholder={
                    connectionModal === "wechat"
                      ? "例如：wx1234567890abcdef"
                      : "https://你的发布服务地址/api/publish"
                  }
                />
              </label>
              <label>
                <span>
                  {connectionModal === "wechat"
                    ? "公众号 AppSecret"
                    : "访问密钥"}
                </span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={connectionForm.apiKey}
                  onChange={(event) =>
                    setConnectionForm((form) => ({
                      ...form,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder={
                    modalInfo.status?.keyConfigured
                      ? connectionModal === "wechat"
                        ? "AppSecret 已保存；留空则保持不变"
                        : "已保存密钥；留空则保持不变"
                      : connectionModal === "wechat"
                        ? "请输入公众号 AppSecret"
                        : "请输入第三方服务提供的访问密钥"
                  }
                />
              </label>
            </div>
            <div className="connection-help">
              <b>如何完成连接</b>
              <p>
                {connectionModal === "wechat"
                  ? "登录微信开发者平台，点左上“我的业务与服务 → 公众号/服务号 → 基础信息 → 开发密钥”，复制 AppID 并启用或重置 AppSecret。"
                  : "向你的第三方发布服务获取接口地址和密钥，在这里直接填写并保存。"}
              </p>
              <p>
                {connectionModal === "wechat"
                  ? "AppSecret 会在服务端加密保存，页面不会读取或回显原文。"
                  : "访问密钥会在服务端加密保存，页面不会读取或回显密钥原文。"}
              </p>
            </div>
            {connectionModal === "wechat" && (
              <div className="official-api-entry">
                <div>
                  <b>微信公众号官方入口</b>
                  <p>
                    开发接口管理已迁移到这里。登录后点左上角“我的业务与服务”，选择“公众号”或“服务号”。
                  </p>
                </div>
                <div className="official-api-links">
                  <a
                    href="https://developers.weixin.qq.com/platform/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    微信开发者平台 <ExternalLink size={13} />
                  </a>
                  <a
                    href="https://mp.weixin.qq.com/cgi-bin/registermidpage?action=index&lang=zh_CN"
                    target="_blank"
                    rel="noreferrer"
                  >
                    没有公众号：先注册 <ExternalLink size={13} />
                  </a>
                  <a
                    href="https://developers.weixin.qq.com/doc/service/guide/product/publish.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    发布能力文档 <ExternalLink size={13} />
                  </a>
                  <a
                    href="https://developers.weixin.qq.com/doc/service/guide/product/draft.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    草稿箱接口文档 <ExternalLink size={13} />
                  </a>
                </div>
                <small>
                  当前路径：我的业务与服务 → 公众号/服务号 → 基础信息 →
                  开发密钥。首次使用可能需要先绑定公众号
                  AppID；发布接口通常需要认证服务号。
                </small>
              </div>
            )}
            <div className="connection-modal-actions">
              <button
                className="secondary"
                onClick={() => setConnectionModal(null)}
              >
                取消
              </button>
              <button
                className="primary"
                onClick={saveConnection}
                disabled={savingConnection}
              >
                {savingConnection ? "保存中…" : "保存连接"}
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [side, setSide] = useState(false);
  const [feedback, setFeedback] = useState("");
  const title = useMemo(
    () =>
      ({
        dashboard: "工作台",
        news: "资讯采集",
        analysis: "选题分析",
        "new-analysis": "新建分析",
        report: "洞察报告",
        create: "内容创作",
        publish: "发布管理",
        editor: "文章编辑",
        settings: "系统设置",
      })[page],
    [page],
  );
  const go = (p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const handler = async (event: MouseEvent) => {
      const button = (event.target as Element)?.closest?.(
        "button",
      ) as HTMLButtonElement | null;
      if (!button) return;
      const label = (button.textContent || "").replace(/\s+/g, " ").trim();
      if (label === "导出报告") {
        window.print();
        return;
      }
      if (label === "重新分析") {
        setPage("new-analysis");
        return;
      }
      if (label === "测试连接") {
        try {
          const r = await fetch("/api/integrations/status");
          const x = await r.json();
          const connected = Object.values(x.data || {}).filter(Boolean).length;
          setFeedback(`连接检查完成：${connected} 项服务可用`);
        } catch {
          setFeedback("连接检查失败，请确认本地服务");
        }
        setTimeout(() => setFeedback(""), 2400);
        return;
      }
      const message = button.dataset.prototypeFeedback;
      if (message) {
        setFeedback(message);
        setTimeout(() => setFeedback(""), 2400);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  return (
    <div className="app-shell">
      <Sidebar page={page} go={go} open={side} close={() => setSide(false)} />
      <div className="main">
        <Topbar title={title} menu={() => setSide(true)} />
        <div className={`page ${page === "editor" ? "editor-page" : ""}`}>
          {page === "dashboard" && <Dashboard go={go} />}{" "}
          {page === "news" && <NewsCollector go={go} />}{" "}
          {page === "analysis" && <Analysis go={go} />}{" "}
          {page === "new-analysis" && <NewAnalysis go={go} />}{" "}
          {page === "report" && <Report go={go} />}{" "}
          {page === "create" && <Create go={go} />}{" "}
          {page === "publish" && <Publish go={go} />}{" "}
          {page === "editor" && <Editor go={go} />}{" "}
          {page === "settings" && <SettingsPage />}
        </div>
      </div>
      {feedback && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {feedback}
        </div>
      )}
    </div>
  );
}
