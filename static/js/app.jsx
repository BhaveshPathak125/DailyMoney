const { useEffect, useMemo, useRef, useState } = React;

const APP_NAME = window.DAILYMONEY_CONFIG.appName;
const AUTH_ROUTES = new Set(["/login", "/register"]);
const PROTECTED_ROUTES = new Set([
  "/",
  "/dashboard",
  "/daily-entry",
  "/monthly-insights",
  "/yearly-analysis",
  "/day-editor",
  "/profile-overview",
  "/account-settings",
]);

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/daily-entry", label: "Daily Entry", icon: "add_circle" },
  { path: "/monthly-insights", label: "Insights", icon: "insights" },
  { path: "/yearly-analysis", label: "Yearly", icon: "leaderboard" },
  { path: "/day-editor", label: "Day Editor", icon: "edit_calendar" },
];

const profileNavItems = [
  { path: "/profile-overview", label: "Profile", icon: "person" },
  { path: "/account-settings", label: "Settings", icon: "settings" },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDateLabel(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function navigate(path, replace = false) {
  if (window.location.pathname === path && !replace) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error((data && data.error) || "Request failed");
  }

  return data;
}

function useAnimatedNumber(value, formatter = formatMoney) {
  const [display, setDisplay] = useState(formatter(0));

  useEffect(() => {
    let frame;
    const start = performance.now();
    const target = Number(value || 0);
    const duration = 900;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(formatter(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, formatter]);

  return display;
}

function ChartCard({ type, data, options, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart || !data) return undefined;
    const chart = new window.Chart(canvasRef.current, { type, data, options });
    return () => chart.destroy();
  }, [type, data, options]);

  return (
    <div className={`chart-shell ${className}`}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;
  const palette =
    flash.type === "error"
      ? "bg-error/10 border-error/20 text-error"
      : "bg-primary-container/10 border-primary-container/20 text-primary";
  return (
    <div className="fixed top-5 left-1/2 z-[70] -translate-x-1/2">
      <div className={`glass-card border px-4 py-3 rounded-xl flex items-center gap-3 ${palette}`}>
        <span className="material-symbols-outlined">{flash.type === "error" ? "error" : "check_circle"}</span>
        <span className="text-sm">{flash.message}</span>
        <button className="text-current/80" onClick={onClose}>
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

function AnimatedStarsBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    let animationFrame;
    let width = 0;
    let height = 0;
    let stars = [];

    const buildStars = () => {
      const count = Math.max(24, Math.floor((width * height) / 52000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.2 + 0.28,
        alpha: Math.random() * 0.45 + 0.08,
        speed: Math.random() * 0.1 + 0.02,
        twinkle: Math.random() * 0.012 + 0.003,
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      stars.forEach((star) => {
        star.y += star.speed;
        star.alpha += (Math.random() - 0.5) * star.twinkle;
        if (star.y > height + 5) {
          star.y = -5;
          star.x = Math.random() * width;
        }
        star.alpha = Math.max(0.12, Math.min(0.88, star.alpha));

        context.beginPath();
        context.fillStyle = `rgba(239, 255, 227, ${star.alpha})`;
        context.shadowBlur = 6;
        context.shadowColor = "rgba(57, 255, 20, 0.08)";
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fill();
      });

      context.shadowBlur = 0;
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="starfield-layer"></canvas>
      <div className="ambient-orb orb-a"></div>
      <div className="ambient-orb orb-b"></div>
    </>
  );
}

function Sidebar({ path }) {
  const sectionClass = "nav-button interactive-surface flex items-center gap-4 px-4 py-3 mx-2 rounded-xl";
  return (
    <aside className="sidebar-transition sidebar-width fixed left-0 top-0 z-50 flex h-screen w-20 md:w-64 flex-col bg-[#131313] border-r border-outline-variant/5">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            account_balance_wallet
          </span>
          <div className="sidebar-wide-only hidden md:block">
            <h1 className="text-xl font-bold tracking-tight text-primary font-headline">{APP_NAME}</h1>
            <p className="text-[10px] text-on-surface-variant tracking-[0.2em] uppercase mt-1">Smart Finance</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 mt-4 space-y-1">
        {navItems.map((item) => {
          const active = path === item.path;
          return (
            <button
              key={item.path}
              className={`${sectionClass} ${active ? "is-active bg-surface-container-high text-primary-container" : "text-on-surface/60 hover:bg-surface-container-highest/30 hover:text-primary-container"}`}
              onClick={() => navigate(item.path)}
            >
              <span className="material-symbols-outlined" style={active ? { fontVariationSettings: "'FILL' 1" } : null}>
                {item.icon}
              </span>
              <span className="sidebar-wide-only hidden md:block text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pb-6 space-y-1">
        {profileNavItems.map((item) => {
          const active = path === item.path;
          return (
            <button
              key={item.path}
              className={`${sectionClass} ${active ? "is-active bg-surface-container-high text-primary-container" : "text-on-surface/60 hover:bg-surface-container-highest/30 hover:text-primary-container"}`}
              onClick={() => navigate(item.path)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="sidebar-wide-only hidden md:block text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function TopBar({ path, onToggle, user, onLogout }) {
  const titleMap = {
    "/dashboard": "Dashboard",
    "/daily-entry": "Daily Entry",
    "/monthly-insights": "Insights",
    "/yearly-analysis": "Yearly Analysis",
    "/day-editor": "Day Editor",
    "/profile-overview": "Profile Overview",
    "/account-settings": "Account Settings",
  };

  return (
    <header className="topbar-transition header-left fixed top-0 right-0 z-40 flex h-20 w-full items-center justify-between bg-[#131313]/80 px-6 md:left-64 md:w-[calc(100%-16rem)] backdrop-blur-md">
      <div className="flex items-center gap-4">
        <button
          className="sidebar-toggle interactive-surface flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-low text-primary-container"
          onClick={onToggle}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary-container">{APP_NAME}</p>
          <h2 className="text-xl sm:text-2xl font-black italic font-headline text-primary">{titleMap[path] || APP_NAME}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="interactive-surface hidden sm:flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-base">person</span>
          <span>{user.name}</span>
        </button>
        <button className="interactive-surface flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant" onClick={onLogout}>
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  );
}

function Layout({ path, collapsed, onToggleSidebar, user, onLogout, children }) {
  return (
    <div className={`page-fade ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar path={path} />
      <TopBar path={path} onToggle={onToggleSidebar} user={user} onLogout={onLogout} />
      <main className="main-transition content-left ml-20 min-h-screen px-4 pb-12 pt-24 md:ml-64 md:px-8">
        <div className="panel-enter">{children}</div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent = "text-primary" }) {
  return (
    <div className="interactive-surface glass-card rounded-2xl border border-outline-variant/10 p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">{label}</p>
      <p className={`counter-glow mt-3 text-2xl font-bold font-headline ${accent}`}>{value}</p>
    </div>
  );
}

function DashboardPage({ state }) {
  const metrics = state.metrics;
  const [range, setRange] = useState("30");
  const totalBalance = useAnimatedNumber(metrics.total_balance);
  const todayNet = useAnimatedNumber(metrics.today_net);

  const chartData = useMemo(() => {
    const series = metrics.cash_flow_ranges[range] || [];
    return {
      labels: series.map((item) => item.short_label),
      datasets: [
        {
          label: "Cash Flow",
          data: series.map((item) => item.amount),
          backgroundColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(57,255,20,0.75)";
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(239,255,227,0.95)");
            gradient.addColorStop(0.45, "rgba(57,255,20,0.72)");
            gradient.addColorStop(1, "rgba(57,255,20,0.12)");
            return gradient;
          },
          borderColor: "#79ff5b",
          borderRadius: 12,
          borderSkipped: false,
        },
      ],
    };
  }, [metrics.cash_flow_ranges, range]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1c1b1b",
          borderColor: "rgba(57,255,20,0.18)",
          borderWidth: 1,
          titleColor: "#efffe3",
          bodyColor: "#e5e2e1",
          callbacks: {
            label: (context) => ` ${formatMoney(context.raw)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: "rgba(186, 204, 176, 0.55)" }, grid: { display: false }, border: { display: false } },
        y: {
          ticks: { color: "rgba(186, 204, 176, 0.55)", callback: (value) => formatMoney(value) },
          grid: { color: "rgba(133,150,124,0.08)" },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-container">Total Money Overview</p>
          <h1 className="counter-glow mt-3 text-4xl md:text-6xl font-black font-headline text-primary">{totalBalance}</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{metrics.current_date_label}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Daily Net" value={todayNet} accent="text-primary" />
          <StatCard label="Savings Rate" value={formatPercent(metrics.savings_rate)} accent="text-secondary" />
          <StatCard label="Income" value={formatMoney(metrics.month_income)} accent="text-secondary" />
          <StatCard label="Expenses" value={formatMoney(metrics.month_expenses)} accent="text-error" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-bold font-headline text-primary">Cash Flow</h3>
                <p className="text-sm text-on-surface-variant">Animated cash movement from your real entries</p>
              </div>
              <div className="flex gap-2">
                {["7", "30", "90"].map((item) => (
                  <button
                    key={item}
                    className={`interactive-surface rounded-full px-3 py-1 text-xs ${range === item ? "bg-primary-container/15 text-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}
                    onClick={() => setRange(item)}
                  >
                    {item}D
                  </button>
                ))}
              </div>
            </div>
            {chartData.labels.length ? (
              <ChartCard type="bar" data={chartData} options={chartOptions} className="mt-6" />
            ) : (
              <div className="mt-6 rounded-2xl bg-surface-container-lowest p-8 text-sm text-on-surface-variant">
                No cash flow yet. Add a few entries and the chart will start moving.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
              <h3 className="text-xl font-bold font-headline text-primary">Monthly Spending</h3>
              <div className="mt-6 space-y-5">
                {metrics.monthly_categories.length ? (
                  metrics.monthly_categories.slice(0, 5).map((category) => {
                    const share = metrics.month_expenses ? (category.amount / metrics.month_expenses) * 100 : 0;
                    return (
                      <div key={category.name}>
                        <div className="mb-2 flex items-end justify-between">
                          <span className="text-xs uppercase tracking-widest" style={{ color: category.style.color }}>
                            {category.name}
                          </span>
                          <span className="text-sm font-bold">{formatMoney(category.amount)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-container-lowest">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(share, 100)}%`,
                              background: `linear-gradient(135deg, ${category.style.soft} 0%, ${category.style.color} 100%)`,
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No spending data yet.</div>
                )}
              </div>
            </div>

            <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
              <h3 className="text-xl font-bold font-headline text-primary">AI Assistant</h3>
              <div className="mt-6 space-y-3">
                {metrics.ai_tips.length ? (
                  metrics.ai_tips.map((tip, index) => (
                    <div key={index} className="rounded-2xl bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                      {tip}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">
                    DailyMoney will generate suggestions here once your own spending pattern builds up.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold font-headline text-primary">Recent Entries</h3>
              <button className="text-xs font-bold uppercase tracking-widest text-primary-container" onClick={() => navigate("/daily-entry")}>
                Add New
              </button>
            </div>
            <div className="space-y-4">
              {metrics.recent_entries.length ? (
                metrics.recent_entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-surface-container-lowest p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{entry.description}</p>
                        <p className="text-xs text-on-surface-variant">
                          {entry.category} • {formatDateLabel(entry.date)}
                        </p>
                      </div>
                      <p className={`font-bold ${entry.type === "income" ? "text-secondary" : "text-on-surface"}`}>{entry.displayAmount}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No entries yet.</div>
              )}
            </div>
          </div>

          <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
            <h3 className="text-xl font-bold font-headline text-primary">Accounts</h3>
            <div className="mt-5 space-y-4">
              {metrics.accounts.length ? (
                metrics.accounts.map((account) => (
                  <div key={account.name} className="flex items-center justify-between rounded-2xl bg-surface-container-lowest p-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-on-surface-variant">{account.name}</p>
                      <p className="mt-1 text-lg font-bold font-headline">{formatMoney(account.balance)}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary-container">account_balance</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">
                  Accounts will appear here after your first tracked entry.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyEntryPage({ state, onCreateEntry, onDeleteEntry, onClearEntries }) {
  const categories = state.categories;
  const metrics = state.metrics;
  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    date: metrics.today_iso,
    category: categories[0] ? categories[0].name : "Other",
    customCategory: "",
    description: "",
    account: "",
  });
  const activeCategory = form.customCategory.trim() || form.category;

  const submit = async (event) => {
    event.preventDefault();
    await onCreateEntry(form);
    setForm({
      amount: "",
      type: "expense",
      date: metrics.today_iso,
      category: categories[0] ? categories[0].name : "Other",
      customCategory: "",
      description: "",
      account: "",
    });
  };

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <section className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-container">New Transaction</p>
              <h2 className="mt-2 text-3xl font-bold font-headline">Log Daily Activity</h2>
            </div>
            <p className="text-sm text-on-surface-variant">{metrics.current_date_label}</p>
          </div>

          <form className="space-y-8" onSubmit={submit}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Amount</label>
                <input
                  className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 text-5xl font-black font-headline text-on-surface focus:ring-0"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Type</label>
                  <select
                    className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0"
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                  >
                    {state.typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Date</label>
                  <input
                    className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0"
                    type="date"
                    max={metrics.today_iso}
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Select Category</label>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {categories.map((category) => {
                  const selected = activeCategory === category.name && !form.customCategory.trim();
                  return (
                    <button
                      key={category.name}
                      type="button"
                      onClick={() => setForm({ ...form, category: category.name, customCategory: "" })}
                      className={`interactive-surface rounded-2xl border p-4 text-center ${selected ? "border-primary-container/40 bg-surface-container-high" : "border-outline-variant/10 bg-surface-container-highest/20"}`}
                    >
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: category.style.soft }}>
                        <span className="material-symbols-outlined" style={{ color: category.style.color }}>
                          {category.icon}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: category.style.color }}>
                        {category.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Description</label>
                <input
                  className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0"
                  placeholder="What was this for?"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Account</label>
                <input
                  className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0"
                  placeholder="Ex: IDFC, Cash, Savings"
                  value={form.account}
                  onChange={(event) => setForm({ ...form, account: event.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Custom Category</label>
              <input
                className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0"
                placeholder="Optional: Rent, Fuel, Medicine"
                value={form.customCategory}
                onChange={(event) => setForm({ ...form, customCategory: event.target.value })}
              />
            </div>

            <button className="interactive-surface w-full rounded-2xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold font-headline text-on-primary">
              Save Entry
            </button>
          </form>
        </section>

        <section className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-container">Manage Data</p>
              <h3 className="mt-2 text-2xl font-bold font-headline">Delete Transactions</h3>
            </div>
            {metrics.entries.length ? (
              <button className="interactive-surface rounded-2xl bg-surface-container-high px-4 py-3 text-sm font-bold uppercase tracking-widest text-error" onClick={onClearEntries}>
                Clear All Data
              </button>
            ) : null}
          </div>
          <div className="space-y-4">
            {metrics.entries.length ? (
              metrics.entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-surface-container-lowest p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{entry.description}</p>
                      <p className="text-xs text-on-surface-variant">
                        {entry.category} • {entry.account} • {formatDateLabel(entry.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-bold ${entry.type === "income" ? "text-secondary" : "text-on-surface"}`}>{entry.displayAmount}</span>
                      <button
                        className="interactive-surface rounded-xl bg-surface-container-high px-4 py-2 text-xs font-bold uppercase tracking-widest text-error"
                        onClick={() => onDeleteEntry(entry.id, entry.date)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">
                No transactions to manage yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <StatCard label="Monthly Budget" value={formatMoney(metrics.monthly_budget)} accent="text-primary" />
        <StatCard label="Spent So Far" value={formatMoney(metrics.month_expenses)} accent="text-secondary" />
        <StatCard label="Budget Remaining" value={formatMoney(metrics.budget_remaining)} accent="text-primary" />
        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
          <h3 className="text-xl font-bold font-headline text-primary">AI Insights</h3>
          <div className="mt-4 space-y-3">
            {metrics.ai_tips.length ? (
              metrics.ai_tips.map((tip, index) => (
                <div key={index} className="rounded-2xl bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                  {tip}
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">Add a few entries to unlock suggestions.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightsPage({ state }) {
  const metrics = state.metrics;
  const [mode, setMode] = useState("daily");
  const series = metrics.insight_chart_modes[mode] || [];

  const chartData = useMemo(() => {
    return {
      labels: series.map((item) => item.label),
      datasets: [
        {
          label: "Income",
          data: series.map((item) => item.income),
          borderColor: "#79ff5b",
          backgroundColor: "rgba(121,255,91,0.16)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: "#39ff14",
        },
        {
          label: "Expenses",
          data: series.map((item) => item.expense),
          borderColor: "#ffb4ab",
          backgroundColor: "rgba(255,180,171,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: "#ffd3ce",
        },
      ],
    };
  }, [series]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { labels: { color: "#e5e2e1" } },
        tooltip: {
          backgroundColor: "#1c1b1b",
          borderColor: "rgba(57,255,20,0.18)",
          borderWidth: 1,
          titleColor: "#efffe3",
          bodyColor: "#e5e2e1",
        },
      },
      scales: {
        x: { ticks: { color: "rgba(186, 204, 176, 0.55)" }, grid: { color: "rgba(133,150,124,0.05)" }, border: { display: false } },
        y: {
          ticks: { color: "rgba(186, 204, 176, 0.55)", callback: (value) => formatMoney(value) },
          grid: { color: "rgba(133,150,124,0.08)" },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Monthly Liquidity</p>
          <h1 className="mt-3 text-5xl font-black font-headline text-primary">{formatMoney(metrics.month_savings)}</h1>
          <p className="mt-2 text-sm text-secondary">{formatPercent(metrics.savings_rate)} savings rate</p>
        </div>

        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold font-headline text-primary">Spending Trajectory</h3>
              <p className="text-sm text-on-surface-variant">Switch between daily and monthly income vs expense lines</p>
            </div>
            <div className="flex gap-2">
              {["daily", "monthly"].map((item) => (
                <button
                  key={item}
                  className={`interactive-surface rounded-full px-3 py-1 text-xs capitalize ${mode === item ? "bg-primary-container/15 text-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}
                  onClick={() => setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {series.length ? (
            <ChartCard type="line" data={chartData} options={chartOptions} className="mt-6" />
          ) : (
            <div className="mt-6 rounded-2xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">No insights yet.</div>
          )}
        </div>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <StatCard label="Budget Used" value={formatPercent(metrics.budget_used)} accent="text-primary" />
        <StatCard label="Saved" value={formatMoney(metrics.month_savings)} accent="text-secondary" />
        <StatCard label="Burn" value={formatMoney(metrics.month_expenses)} accent="text-error" />
        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
          <h3 className="text-xl font-bold font-headline text-primary">Category Allocation</h3>
          <div className="mt-5 space-y-4">
            {metrics.monthly_categories.length ? (
              metrics.monthly_categories.map((category) => (
                <div key={category.name} className="rounded-2xl bg-surface-container-lowest p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-xs text-on-surface-variant">{category.count} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatMoney(category.amount)}</p>
                      <p className="text-[11px]" style={{ color: category.style.color }}>
                        {metrics.month_expenses ? formatPercent((category.amount / metrics.month_expenses) * 100) : "0.0%"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No category data yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function YearlyPage({ state }) {
  const metrics = state.metrics;
  const [range, setRange] = useState("12");
  const series = metrics.year_breakdown_ranges[range] || [];

  const chartData = useMemo(
    () => ({
      labels: series.map((item) => item.label),
      datasets: [
        {
          label: "Inflow",
          data: series.map((item) => item.income),
          backgroundColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(57,255,20,0.55)";
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(239,255,227,0.95)");
            gradient.addColorStop(0.4, "rgba(57,255,20,0.82)");
            gradient.addColorStop(1, "rgba(57,255,20,0.16)");
            return gradient;
          },
          borderColor: "#79ff5b",
          borderRadius: 12,
          borderSkipped: false,
        },
        {
          label: "Outflow",
          data: series.map((item) => item.expense),
          backgroundColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(255,180,171,0.45)";
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, "rgba(255,218,214,0.92)");
            gradient.addColorStop(0.45, "rgba(255,180,171,0.72)");
            gradient.addColorStop(1, "rgba(255,180,171,0.14)");
            return gradient;
          },
          borderColor: "#ffdad6",
          borderRadius: 12,
          borderSkipped: false,
        },
      ],
    }),
    [series]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#e5e2e1" } } },
      scales: {
        x: { ticks: { color: "rgba(186, 204, 176, 0.55)" }, grid: { display: false }, border: { display: false } },
        y: {
          ticks: { color: "rgba(186, 204, 176, 0.55)", callback: (value) => formatMoney(value) },
          grid: { color: "rgba(133,150,124,0.08)" },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-container">Annual Performance {metrics.current_year_label}</p>
          <h1 className="mt-3 text-5xl md:text-7xl font-black font-headline text-primary">{formatMoney(metrics.year_income - metrics.year_expenses)}</h1>
        </div>

        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold font-headline text-primary">Capital Velocity</h3>
              <p className="text-sm text-on-surface-variant">Yearly inflow vs outflow by period</p>
            </div>
            <div className="flex gap-2">
              {["6", "12"].map((item) => (
                <button
                  key={item}
                  className={`interactive-surface rounded-full px-3 py-1 text-xs ${range === item ? "bg-primary-container/15 text-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}
                  onClick={() => setRange(item)}
                >
                  {item}M
                </button>
              ))}
            </div>
          </div>
          {series.length ? (
            <ChartCard type="bar" data={chartData} options={chartOptions} className="mt-6" />
          ) : (
            <div className="mt-6 rounded-2xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">No yearly trend data yet.</div>
          )}
        </div>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <StatCard label="Income" value={formatMoney(metrics.year_income)} accent="text-secondary" />
        <StatCard label="Expenses" value={formatMoney(metrics.year_expenses)} accent="text-error" />
        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
          <h3 className="text-xl font-bold font-headline text-primary">Sector Breakdown</h3>
          <div className="mt-5 space-y-4">
            {metrics.monthly_categories.length ? (
              metrics.monthly_categories.map((category) => (
                <div key={category.name}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{category.name}</span>
                    <span>{formatMoney(category.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-lowest">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${metrics.month_expenses ? Math.min((category.amount / metrics.month_expenses) * 100, 100) : 0}%`,
                        background: category.style.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No category breakdown yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayEditorPage({ state, onSelectDate, onUpdateEntry, onDeleteEntry }) {
  const editor = state.dayEditor;
  const categories = state.categories;
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts({});
  }, [editor.editDate]);

  const getDraft = (entry) =>
    drafts[entry.id] || {
      amount: entry.amount,
      type: entry.type,
      date: entry.date,
      category: entry.category,
      customCategory: "",
      description: entry.description,
      account: entry.account,
    };

  const updateDraft = (entryId, next) => {
    setDrafts((current) => ({ ...current, [entryId]: { ...current[entryId], ...next } }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary-container">Calendar Navigator</p>
            <h2 className="mt-2 text-3xl font-bold font-headline">Edit Previous Days</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label="Income" value={formatMoney(editor.summary.income)} accent="text-secondary" />
            <StatCard label="Expenses" value={formatMoney(editor.summary.expenses)} accent="text-error" />
            <StatCard label="Net" value={formatMoney(editor.summary.net)} accent="text-primary" />
          </div>
        </div>

        <div className="rounded-3xl bg-surface-container-lowest/70 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <button className="interactive-surface rounded-xl bg-surface-container-low px-4 py-2" onClick={() => onSelectDate(editor.calendar.prevMonthIso)}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h3 className="text-lg font-bold font-headline">{editor.calendar.label}</h3>
            <button
              className="interactive-surface rounded-xl bg-surface-container-low px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => editor.calendar.nextMonthIso && onSelectDate(editor.calendar.nextMonthIso)}
              disabled={!editor.calendar.nextMonthIso}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-widest text-on-surface-variant">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {editor.calendar.weeks.map((week, index) => (
              <div key={index} className="grid grid-cols-7 gap-2">
                {week.map((day) => (
                  <button
                    key={day.iso}
                    disabled={!day.isClickable}
                    onClick={() => onSelectDate(day.iso)}
                    className={`calendar-cell min-h-[78px] rounded-2xl border p-3 text-left ${day.isSelected ? "border-primary-container/40 bg-primary-container/10" : "border-outline-variant/10 bg-surface-container-low"} ${!day.inMonth ? "opacity-30" : ""} ${day.isFuture ? "cursor-not-allowed opacity-30" : "interactive-surface"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${day.isSelected ? "text-primary" : "text-on-surface"}`}>{day.day}</span>
                      {day.hasEntries ? <span className="h-2 w-2 rounded-full bg-primary-container"></span> : null}
                    </div>
                    {day.isSelected ? <p className="mt-4 text-[11px] uppercase tracking-widest text-primary-container">Selected</p> : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary-container">Selected Day</p>
            <h3 className="mt-2 text-2xl font-bold font-headline">{formatDateLabel(editor.editDate)}</h3>
          </div>
        </div>
        <div className="space-y-5">
          {editor.selectedEntries.length ? (
            editor.selectedEntries.map((entry) => {
              const draft = getDraft(entry);
              return (
                <div key={entry.id} className="rounded-3xl bg-surface-container-lowest p-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input className="rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" value={draft.description} onChange={(event) => updateDraft(entry.id, { description: event.target.value })} />
                    <input className="rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" value={draft.account} onChange={(event) => updateDraft(entry.id, { account: event.target.value })} />
                    <input className="rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" type="number" step="0.01" min="0" value={draft.amount} onChange={(event) => updateDraft(entry.id, { amount: event.target.value })} />
                    <input className="rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" type="date" max={state.metrics.today_iso} value={draft.date} onChange={(event) => updateDraft(entry.id, { date: event.target.value })} />
                    <select className="rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" value={draft.type} onChange={(event) => updateDraft(entry.id, { type: event.target.value })}>
                      {state.typeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select className="rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" value={draft.category} onChange={(event) => updateDraft(entry.id, { category: event.target.value, customCategory: "" })}>
                      {categories.map((category) => (
                        <option key={category.name} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <div className="md:col-span-2">
                      <input className="w-full rounded-2xl border-none bg-surface-container-low p-3 focus:ring-0" placeholder="Optional custom category" value={draft.customCategory} onChange={(event) => updateDraft(entry.id, { customCategory: event.target.value })} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button className="interactive-surface rounded-2xl bg-primary-container/15 px-4 py-3 text-sm font-bold text-primary" onClick={() => onUpdateEntry(entry.id, draft)}>
                      Save Changes
                    </button>
                    <button className="interactive-surface rounded-2xl bg-surface-container-high px-4 py-3 text-sm font-bold text-error" onClick={() => onDeleteEntry(entry.id, editor.editDate)}>
                      Delete Entry
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No entries exist for this day yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileOverviewPage({ state }) {
  const { user, metrics } = state;
  const profile = user.profile || {};
  const initials = (user.name || APP_NAME)
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="xl:col-span-8 flex flex-col gap-8 md:flex-row md:items-end">
          <div className="flex h-48 w-48 items-center justify-center rounded-[2rem] bg-gradient-to-br from-surface-container-high to-surface-container-lowest text-6xl font-black font-headline text-primary shadow-[0_0_40px_rgba(57,255,20,0.08)]">
            {initials}
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-primary-container">{profile.title || "Member"}</p>
            <h1 className="text-5xl md:text-7xl font-black font-headline">{user.name}</h1>
            <p className="max-w-2xl text-on-surface-variant">{profile.bio || "No bio added yet."}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="rounded-xl bg-surface-container-low px-4 py-2 text-sm">{profile.location || "India"}</div>
              <div className="rounded-xl bg-surface-container-low px-4 py-2 text-sm">{user.email}</div>
            </div>
          </div>
        </div>
        <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-8 xl:col-span-4">
          <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Current Liquidity Index</p>
          <h2 className="mt-3 text-5xl font-black font-headline text-primary">{(100 - Math.min(metrics.budget_used, 100)).toFixed(1)}</h2>
          <p className="mt-2 text-sm text-on-surface-variant">A simple health score based on your current budget usage and savings rate.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tracked Money" value={formatMoney(metrics.total_balance)} accent="text-primary" />
        <StatCard label="Monthly Income" value={formatMoney(metrics.month_income)} accent="text-secondary" />
        <StatCard label="Monthly Expenses" value={formatMoney(metrics.month_expenses)} accent="text-error" />
        <StatCard label="Savings Rate" value={formatPercent(metrics.savings_rate)} accent="text-primary" />
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold font-headline">Recent Activity</h3>
            <button className="text-xs font-bold uppercase tracking-widest text-primary-container" onClick={() => navigate("/daily-entry")}>
              Open Ledger
            </button>
          </div>
          {metrics.recent_entries.length ? (
            metrics.recent_entries.map((entry) => (
              <div key={entry.id} className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-lowest text-primary-container">
                      <span className="material-symbols-outlined">{entry.type === "income" ? "payments" : "shopping_cart"}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{entry.description}</p>
                      <p className="text-xs text-on-surface-variant">
                        {entry.category} • {formatDateLabel(entry.date)}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${entry.type === "income" ? "text-secondary" : "text-on-surface"}`}>{entry.displayAmount}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No activity has been recorded yet.</div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-6">
            <h3 className="text-xl font-bold font-headline text-primary">Asset Allocation</h3>
            <div className="mt-5 space-y-4">
              {metrics.monthly_categories.length ? (
                metrics.monthly_categories.map((category) => (
                  <div key={category.name}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{category.name}</span>
                      <span>{metrics.month_expenses ? formatPercent((category.amount / metrics.month_expenses) * 100) : "0.0%"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container-lowest">
                      <div className="h-full rounded-full" style={{ width: `${metrics.month_expenses ? Math.min((category.amount / metrics.month_expenses) * 100, 100) : 0}%`, background: category.style.color }}></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-surface-container-lowest p-5 text-sm text-on-surface-variant">Allocation will appear when you start spending.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ state, onSaveProfile, onSaveSettings }) {
  const { user, metrics } = state;
  const profile = user.profile || {};
  const preferences = user.preferences || {};
  const notifications = preferences.notifications || {};
  const [profileForm, setProfileForm] = useState({
    name: user.name || "",
    title: profile.title || "",
    location: profile.location || "",
    bio: profile.bio || "",
  });
  const [settingsForm, setSettingsForm] = useState({
    currency: user.settings.currency || "INR",
    monthlyBudget: user.settings.monthly_budget || 0,
    monthlyIncomeTarget: user.settings.monthly_income_target || 0,
    notifications: {
      weeklyDigest: notifications.weekly_digest !== false,
      budgetAlerts: notifications.budget_alerts !== false,
      unusualActivity: Boolean(notifications.unusual_activity),
    },
  });

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <section className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary-container">Profile Configuration</p>
              <h2 className="mt-2 text-3xl font-bold font-headline">Personal Settings</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Full Name</label>
              <input className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Title</label>
              <input className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" value={profileForm.title} onChange={(event) => setProfileForm({ ...profileForm, title: event.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Location</label>
              <input className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" value={profileForm.location} onChange={(event) => setProfileForm({ ...profileForm, location: event.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Email</label>
              <input className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 text-on-surface-variant focus:ring-0" value={user.email} readOnly />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Bio</label>
              <textarea className="mt-2 h-32 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}></textarea>
            </div>
          </div>
          <button className="interactive-surface mt-6 rounded-2xl bg-primary-container/15 px-5 py-3 font-bold text-primary" onClick={() => onSaveProfile(profileForm)}>
            Save Profile
          </button>
        </section>

        <section className="interactive-surface glass-card rounded-3xl border border-outline-variant/10 p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-primary-container">Finance Configuration</p>
            <h2 className="mt-2 text-3xl font-bold font-headline">Tracking Settings</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Currency</label>
              <select className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" value={settingsForm.currency} onChange={(event) => setSettingsForm({ ...settingsForm, currency: event.target.value })}>
                <option value="INR">INR - Indian Rupee</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Monthly Budget</label>
              <input className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" type="number" min="0" step="0.01" value={settingsForm.monthlyBudget} onChange={(event) => setSettingsForm({ ...settingsForm, monthlyBudget: event.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Monthly Income Target</label>
              <input className="mt-2 w-full rounded-2xl border-none bg-surface-container-lowest p-4 focus:ring-0" type="number" min="0" step="0.01" value={settingsForm.monthlyIncomeTarget} onChange={(event) => setSettingsForm({ ...settingsForm, monthlyIncomeTarget: event.target.value })} />
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {[
              ["weeklyDigest", "Weekly Insight Digest"],
              ["budgetAlerts", "Budget Alerts"],
              ["unusualActivity", "Unusual Activity"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-2xl bg-surface-container-lowest px-4 py-4">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.notifications[key])}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      notifications: { ...settingsForm.notifications, [key]: event.target.checked },
                    })
                  }
                />
              </label>
            ))}
          </div>

          <button className="interactive-surface mt-6 rounded-2xl bg-primary-container/15 px-5 py-3 font-bold text-primary" onClick={() => onSaveSettings(settingsForm)}>
            Save Finance Settings
          </button>
        </section>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <StatCard label="Current Budget" value={formatMoney(metrics.monthly_budget)} accent="text-primary" />
        <StatCard label="Budget Used" value={formatPercent(metrics.budget_used)} accent="text-secondary" />
        <StatCard label="Income Target" value={formatMoney(metrics.monthly_income_target)} accent="text-primary" />
      </div>
    </div>
  );
}

function AuthLayout({ children }) {
  return (
    <main className="auth-grid relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute -left-16 -top-12 h-72 w-72 rounded-full bg-primary-container/10 blur-[110px]"></div>
      <div className="absolute -bottom-16 -right-10 h-80 w-80 rounded-full bg-sky-400/10 blur-[120px]"></div>
      <div className="relative z-10 w-full max-w-6xl">{children}</div>
    </main>
  );
}

function LoginPage({ onLogin, onForgotPassword, onError, goRegister }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetForm, setResetForm] = useState({ email: "", newPassword: "", confirmPassword: "" });

  const submitForgotPassword = async (event) => {
    event.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      onError("Passwords do not match.");
      return;
    }
    await onForgotPassword({ email: resetForm.email, newPassword: resetForm.newPassword });
    setShowForgotPassword(false);
    setResetForm({ email: "", newPassword: "", confirmPassword: "" });
  };

  return (
    <AuthLayout>
      <div className="mx-auto max-w-xl">
        <div className="mb-10 text-center">
          <span className="material-symbols-outlined text-5xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
            account_balance_wallet
          </span>
          <h1 className="mt-4 text-3xl font-black font-headline italic text-primary">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Login to continue tracking your money daily.</p>
        </div>
        <div className="glass-card rounded-[2rem] border border-outline-variant/10 p-8 md:p-10">
          <h2 className="text-2xl font-bold font-headline">Welcome Back</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Please enter your account details.</p>
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              onLogin(form);
            }}
          >
            <input className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0" placeholder="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <input className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0" placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-widest text-primary-container"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetForm((current) => ({ ...current, email: form.email }));
                }}
              >
                Forgot Password?
              </button>
            </div>
            <button className="interactive-surface w-full rounded-2xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold font-headline text-on-primary">Log In</button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Don&apos;t have an account?
          <button className="ml-2 font-semibold text-primary-container" onClick={goRegister}>
            Sign up
          </button>
        </p>

        {showForgotPassword ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4">
            <div className="glass-card w-full max-w-md rounded-[2rem] border border-outline-variant/10 p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold font-headline text-primary">Reset Password</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Enter the registered email and set a new password.
                  </p>
                </div>
                <button className="text-on-surface-variant" onClick={() => setShowForgotPassword(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form
                className="space-y-4"
                onSubmit={submitForgotPassword}
              >
                <input
                  className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0"
                  placeholder="Registered email"
                  type="email"
                  value={resetForm.email}
                  onChange={(event) => setResetForm({ ...resetForm, email: event.target.value })}
                />
                <input
                  className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0"
                  placeholder="New password"
                  type="password"
                  value={resetForm.newPassword}
                  onChange={(event) => setResetForm({ ...resetForm, newPassword: event.target.value })}
                />
                <input
                  className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0"
                  placeholder="Confirm new password"
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })}
                />
                <button className="interactive-surface w-full rounded-2xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold font-headline text-on-primary">
                  Reset Password
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}

function RegisterPage({ onRegister, goLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  return (
    <AuthLayout>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="hidden lg:block space-y-8">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_balance_wallet
            </span>
            <h1 className="text-2xl font-black font-headline italic text-primary">{APP_NAME}</h1>
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-black font-headline leading-tight">
              Precision finance for the <span className="text-primary-container">modern daily routine.</span>
            </h2>
            <p className="max-w-lg text-lg text-on-surface-variant">
              Create your account and keep your tracking, insights, profile, and settings in one place while staying database-light for now.
            </p>
          </div>
        </div>
        <div className="glass-card rounded-[2rem] border border-outline-variant/10 p-8 md:p-12">
          <h3 className="text-3xl font-bold font-headline">Create Account</h3>
          <p className="mt-2 text-sm text-on-surface-variant">Start your personal finance workspace.</p>
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              onRegister(form);
            }}
          >
            <input className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0" placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0" placeholder="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <input className="w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 focus:border-primary-container focus:ring-0" placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <button className="interactive-surface flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold font-headline text-on-primary">
              Create Account
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Already have access?
            <button className="ml-2 font-semibold text-primary-container" onClick={goLogin}>
              Log in
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

function LoadingScreen({ label = "Loading DailyMoney..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="glass-card rounded-3xl border border-outline-variant/10 px-6 py-5 text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [sessionState, setSessionState] = useState({ loading: true, authenticated: false, user: null });
  const [appState, setAppState] = useState(null);
  const [loadingApp, setLoadingApp] = useState(false);
  const [flash, setFlash] = useState(null);
  const [editDate, setEditDate] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("dm_sidebar") === "collapsed");

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    localStorage.setItem("dm_sidebar", sidebarCollapsed ? "collapsed" : "open");
  }, [sidebarCollapsed]);

  const showFlash = (message, type = "success") => {
    setFlash({ message, type });
    window.clearTimeout(showFlash._timer);
    showFlash._timer = window.setTimeout(() => setFlash(null), 3200);
  };

  const fetchAppState = async (forcedDate = null) => {
    setLoadingApp(true);
    try {
      const query = forcedDate ? `?edit_date=${encodeURIComponent(forcedDate)}` : "";
      const data = await apiJson(`/api/app-state${query}`);
      setAppState(data.state);
      setSessionState((current) => ({ ...current, authenticated: true, user: data.state.user }));
      if (data.state.dayEditor) setEditDate(data.state.dayEditor.editDate);
    } finally {
      setLoadingApp(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson("/api/auth/session");
        if (cancelled) return;
        setSessionState({ loading: false, authenticated: data.authenticated, user: data.user });

        if (!data.authenticated && PROTECTED_ROUTES.has(path)) {
          navigate("/login", true);
          return;
        }

        if (data.authenticated && AUTH_ROUTES.has(path)) {
          navigate("/dashboard", true);
          return;
        }

        if (data.authenticated && PROTECTED_ROUTES.has(path)) {
          const routeDate = path === "/day-editor" ? editDate : null;
          await fetchAppState(routeDate);
        }
      } catch (error) {
        if (!cancelled) {
          setSessionState({ loading: false, authenticated: false, user: null });
          showFlash(error.message || "Unable to load the app.", "error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  const handleAuth = async (endpoint, payload) => {
    try {
      const data = await apiJson(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setSessionState({ loading: false, authenticated: true, user: data.user });
      showFlash(endpoint.includes("register") ? "Account created successfully." : "Logged in successfully.");
      navigate("/dashboard", true);
      await fetchAppState();
    } catch (error) {
      showFlash(error.message, "error");
    }
  };

  const handleForgotPassword = async (payload) => {
    try {
      const data = await apiJson("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          new_password: payload.newPassword,
        }),
      });
      showFlash(data.message || "Password reset successfully.");
    } catch (error) {
      showFlash(error.message, "error");
      throw error;
    }
  };

  const mutateState = async (requestFactory, successMessage, forcedDate = null) => {
    try {
      const data = await requestFactory();
      if (data.state) {
        setAppState(data.state);
        setSessionState((current) => ({ ...current, user: data.state.user }));
        if (data.state.dayEditor) setEditDate(data.state.dayEditor.editDate);
      } else if (data.user) {
        setSessionState((current) => ({ ...current, user: data.user }));
        setAppState((current) => (current ? { ...current, user: data.user } : current));
      }
      if (forcedDate) setEditDate(forcedDate);
      if (successMessage) showFlash(successMessage);
    } catch (error) {
      showFlash(error.message, "error");
    }
  };

  const handleLogout = async () => {
    await mutateState(() => apiJson("/api/auth/logout", { method: "POST" }), "Logged out.");
    setAppState(null);
    setSessionState({ loading: false, authenticated: false, user: null });
    navigate("/login", true);
  };

  const handleCreateEntry = async (payload) => {
    await mutateState(() => apiJson("/api/entries", { method: "POST", body: JSON.stringify(payload) }), "Entry saved.");
  };

  const handleUpdateEntry = async (entryId, payload) => {
    await mutateState(
      () => apiJson(`/api/entries/${entryId}`, { method: "PUT", body: JSON.stringify(payload) }),
      "Entry updated.",
      payload.date
    );
  };

  const handleDeleteEntry = async (entryId, dateValue) => {
    await mutateState(() => apiJson(`/api/entries/${entryId}?edit_date=${encodeURIComponent(dateValue || "")}`, { method: "DELETE" }), "Entry deleted.", dateValue);
  };

  const handleClearEntries = async () => {
    await mutateState(() => apiJson("/api/entries", { method: "DELETE" }), "All entries cleared.");
  };

  const handleSelectDate = async (dateValue) => {
    setEditDate(dateValue);
    await fetchAppState(dateValue);
  };

  const handleSaveProfile = async (payload) => {
    await mutateState(() => apiJson("/api/profile", { method: "PATCH", body: JSON.stringify(payload) }), "Profile saved.");
  };

  const handleSaveSettings = async (payload) => {
    await mutateState(() => apiJson("/api/settings", { method: "PATCH", body: JSON.stringify(payload) }), "Settings saved.");
  };

  if (sessionState.loading) {
    return <LoadingScreen />;
  }

  if (!sessionState.authenticated) {
    return (
      <>
        <AnimatedStarsBackground />
        <FlashBanner flash={flash} onClose={() => setFlash(null)} />
        {path === "/register" ? (
          <RegisterPage onRegister={(payload) => handleAuth("/api/auth/register", payload)} goLogin={() => navigate("/login")} />
        ) : (
          <LoginPage
            onLogin={(payload) => handleAuth("/api/auth/login", payload)}
            onForgotPassword={handleForgotPassword}
            onError={(message) => showFlash(message, "error")}
            goRegister={() => navigate("/register")}
          />
        )}
      </>
    );
  }

  if (!appState || loadingApp) {
    return (
      <>
        <FlashBanner flash={flash} onClose={() => setFlash(null)} />
        <LoadingScreen label="Loading your workspace..." />
      </>
    );
  }

  let page = <DashboardPage state={appState} />;
  if (path === "/daily-entry") page = <DailyEntryPage state={appState} onCreateEntry={handleCreateEntry} onDeleteEntry={handleDeleteEntry} onClearEntries={handleClearEntries} />;
  if (path === "/monthly-insights") page = <InsightsPage state={appState} />;
  if (path === "/yearly-analysis") page = <YearlyPage state={appState} />;
  if (path === "/day-editor") page = <DayEditorPage state={appState} onSelectDate={handleSelectDate} onUpdateEntry={handleUpdateEntry} onDeleteEntry={handleDeleteEntry} />;
  if (path === "/profile-overview") page = <ProfileOverviewPage state={appState} />;
  if (path === "/account-settings") page = <SettingsPage state={appState} onSaveProfile={handleSaveProfile} onSaveSettings={handleSaveSettings} />;

  return (
    <div className="app-stage">
      <AnimatedStarsBackground />
      <FlashBanner flash={flash} onClose={() => setFlash(null)} />
      <Layout path={path === "/" ? "/dashboard" : path} collapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} user={sessionState.user} onLogout={handleLogout}>
        {page}
      </Layout>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
