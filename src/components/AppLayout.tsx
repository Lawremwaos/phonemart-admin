import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { useShop } from "../context/ShopContext";

function IconMenu(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}
function IconClose(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
function IconGrid(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={props.className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconWrench(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={props.className} aria-hidden>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconBox(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={props.className} aria-hidden>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTruck(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={props.className} aria-hidden>
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5 18a2 2 0 104 0M15 18a2 2 0 104 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChart(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={props.className} aria-hidden>
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
    </svg>
  );
}
function IconSettings(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

const navLinkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 text-[var(--pm-ink-soft)] hover:bg-[var(--pm-surface-soft)] hover:text-[var(--pm-ink)]";
const navLinkActive = "bg-[var(--pm-accent-soft)] text-[var(--pm-accent-strong)] shadow-[inset_0_0_0_1px_rgba(79,122,101,0.28)]";
const subLinkBase =
  "block rounded-lg px-3 py-2 text-[13px] transition-colors text-[var(--pm-ink-soft)] hover:bg-[var(--pm-surface-soft)] hover:text-[var(--pm-ink)]";
const subLinkActive = "bg-[var(--pm-surface-soft)] text-[var(--pm-accent-strong)] font-medium";

type AppLayoutProps = { children: ReactNode };

export default function AppLayout({ children }: AppLayoutProps) {
  const { currentUser, currentShop, logout } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [repairMenuOpen, setRepairMenuOpen] = useState(true);
  const [accessoriesMenuOpen, setAccessoriesMenuOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const SidebarBody = (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] p-4 shadow-sm">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--pm-accent)]/12 blur-2xl" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--pm-ink-soft)]">Signed in</p>
        <p className="mt-1 truncate font-semibold text-[var(--pm-ink)]">{currentUser?.name}</p>
        <p className="mt-0.5 text-xs capitalize text-[var(--pm-ink-soft)]">{currentUser?.roles.join(", ")}</p>
        {currentShop && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--pm-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--pm-accent-strong)] ring-1 ring-[rgba(79,122,101,0.25)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--pm-accent)]" />
            {currentShop.name}
          </p>
        )}
      </div>

      <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(91,104,110,0.35)_transparent]">
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Overview</p>
        <Link
          to="/"
          className={`${navLinkBase} ${location.pathname === "/" ? navLinkActive : ""}`}
        >
          <IconGrid className="h-4 w-4 shrink-0 opacity-80" />
          Dashboard
        </Link>

        <p className="mb-1 mt-5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Operations</p>
        <button
          type="button"
          onClick={() => setRepairMenuOpen(!repairMenuOpen)}
          className={`${navLinkBase} w-full justify-between text-left ${location.pathname.startsWith("/repairs") || location.pathname.includes("pending-collections") || location.pathname.includes("cost-of-parts") || location.pathname.includes("returns") || location.pathname.includes("repair-") ? "text-[var(--pm-ink)]" : ""}`}
        >
          <span className="flex items-center gap-3">
            <IconWrench className="h-4 w-4 shrink-0 opacity-80" />
            Repair
          </span>
          <span className="text-xs text-[var(--pm-ink-soft)]">{repairMenuOpen ? "▾" : "▸"}</span>
        </button>
        {repairMenuOpen && (
          <ul className="ml-2 space-y-0.5 border-l border-[var(--pm-border)] pl-3">
            <li>
              <Link to="/repairs" className={`${subLinkBase} ${location.pathname === "/repairs" ? subLinkActive : ""}`}>
                Repairs
              </Link>
            </li>
            <li>
              <Link to="/repair-sales" className={`${subLinkBase} ${location.pathname === "/repair-sales" ? subLinkActive : ""}`}>
                Repair Sale
              </Link>
            </li>
            <li>
              <Link
                to="/pending-collections/pending-payment"
                className={`${subLinkBase} ${location.pathname.includes("/pending-collections/pending-payment") ? subLinkActive : ""}`}
              >
                Pending Payment
              </Link>
            </li>
            <li>
              <Link
                to="/pending-collections/fully-paid"
                className={`${subLinkBase} ${location.pathname.includes("/pending-collections/fully-paid") ? subLinkActive : ""}`}
              >
                Fully Paid
              </Link>
            </li>
            <li>
              <Link to="/cost-of-parts" className={`${subLinkBase} ${location.pathname === "/cost-of-parts" ? subLinkActive : ""}`}>
                Cost of Parts
              </Link>
            </li>
            <li>
              <Link to="/returns" className={`${subLinkBase} ${location.pathname === "/returns" ? subLinkActive : ""}`}>
                Returns & Warranty
              </Link>
            </li>
            <li>
              <Link to="/repair-sale-profit" className={`${subLinkBase} ${location.pathname === "/repair-sale-profit" ? subLinkActive : ""}`}>
                Repair Sale Profit
              </Link>
            </li>
            <li>
              <Link to="/repair-report" className={`${subLinkBase} ${location.pathname === "/repair-report" ? subLinkActive : ""}`}>
                Repair Report
              </Link>
            </li>
          </ul>
        )}

        <button
          type="button"
          onClick={() => setAccessoriesMenuOpen(!accessoriesMenuOpen)}
          className={`${navLinkBase} mt-1 w-full justify-between text-left`}
        >
          <span className="flex items-center gap-3">
            <IconBox className="h-4 w-4 shrink-0 opacity-80" />
            Accessories
          </span>
          <span className="text-xs text-[var(--pm-ink-soft)]">{accessoriesMenuOpen ? "▾" : "▸"}</span>
        </button>
        {accessoriesMenuOpen && (
          <ul className="ml-2 space-y-0.5 border-l border-[var(--pm-border)] pl-3">
            <li>
              <Link to="/sales" className={`${subLinkBase} ${location.pathname === "/sales" ? subLinkActive : ""}`}>
                Accessories Sale
              </Link>
            </li>
            {currentUser?.roles.includes("admin") && (
              <li>
                <Link to="/purchases" className={`${subLinkBase} ${location.pathname === "/purchases" ? subLinkActive : ""}`}>
                  Purchase
                </Link>
              </li>
            )}
            <li>
              <Link to="/staff-purchases" className={`${subLinkBase} ${location.pathname === "/staff-purchases" ? subLinkActive : ""}`}>
                Staff Purchases
              </Link>
            </li>
            {currentUser?.roles.includes("admin") && (
              <li>
                <Link to="/procurement-review" className={`${subLinkBase} ${location.pathname === "/procurement-review" ? subLinkActive : ""}`}>
                  Procurement Review
                </Link>
              </li>
            )}
            <li>
              <Link to="/stock-allocation" className={`${subLinkBase} ${location.pathname === "/stock-allocation" ? subLinkActive : ""}`}>
                {currentUser?.roles.includes("admin") || currentUser?.roles.includes("manager") ? "Stock Allocation" : "My Stock Transfers"}
              </Link>
            </li>
            <li>
              <Link to="/exchange" className={`${subLinkBase} ${location.pathname === "/exchange" ? subLinkActive : ""}`}>
                Exchange
              </Link>
            </li>
            <li>
              <Link to="/accessory-profit" className={`${subLinkBase} ${location.pathname === "/accessory-profit" ? subLinkActive : ""}`}>
                Accessory Profit
              </Link>
            </li>
            <li>
              <Link to="/accessories-report" className={`${subLinkBase} ${location.pathname === "/accessories-report" ? subLinkActive : ""}`}>
                Accessories Report
              </Link>
            </li>
          </ul>
        )}

        <Link
          to="/suppliers"
          className={`${navLinkBase} mt-1 ${location.pathname === "/suppliers" ? navLinkActive : ""}`}
        >
          <IconTruck className="h-4 w-4 shrink-0 opacity-80" />
          Suppliers
        </Link>
        <Link to="/inventory" className={`${navLinkBase} ${location.pathname === "/inventory" ? navLinkActive : ""}`}>
          <IconBox className="h-4 w-4 shrink-0 opacity-80" />
          Inventory
        </Link>

        {currentUser?.roles.includes("admin") && (
          <>
            <p className="mb-1 mt-5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Reports</p>
            <Link to="/daily-report" className={`${navLinkBase} ${location.pathname === "/daily-report" ? navLinkActive : ""}`}>
              <IconChart className="h-4 w-4 shrink-0 opacity-80" />
              Daily Reports
            </Link>
            <Link
              to="/admin-daily-financial"
              className={`${navLinkBase} ${location.pathname === "/admin-daily-financial" ? navLinkActive : ""}`}
            >
              <IconChart className="h-4 w-4 shrink-0 opacity-80" />
              Daily Financial (Profit)
            </Link>
          </>
        )}

        {currentUser?.roles.includes("admin") && (
          <>
            <p className="mb-1 mt-5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Admin</p>
            <Link to="/admin-settings" className={`${navLinkBase} ${location.pathname === "/admin-settings" ? navLinkActive : ""}`}>
              <IconSettings className="h-4 w-4 shrink-0 opacity-80" />
              Admin Settings
            </Link>
            <Link
              to="/admin-customer-management"
              className={`${navLinkBase} ${location.pathname === "/admin-customer-management" ? navLinkActive : ""}`}
            >
              <IconGrid className="h-4 w-4 shrink-0 opacity-80" />
              Customer Management
            </Link>
            <Link
              to="/stock-exchange-report"
              className={`${navLinkBase} ${location.pathname === "/stock-exchange-report" ? navLinkActive : ""}`}
            >
              <IconChart className="h-4 w-4 shrink-0 opacity-80" />
              Stock Exchange Report
            </Link>
          </>
        )}
        {!currentUser?.roles.includes("admin") && (
          <Link
            to="/stock-exchange-report"
            className={`${navLinkBase} mt-1 ${location.pathname === "/stock-exchange-report" ? navLinkActive : ""}`}
          >
            <IconChart className="h-4 w-4 shrink-0 opacity-80" />
            Stock Exchange Report
          </Link>
        )}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-auto shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 hover:text-red-900"
      >
        Log out
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--pm-canvas)]">
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity md:hidden ${mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[min(20rem,88vw)] flex-col border-r border-[var(--pm-border)] bg-[var(--pm-surface)] px-4 pb-5 pt-5 shadow-2xl shadow-slate-900/20 transition-transform duration-300 ease-out md:static md:z-auto md:w-72 md:translate-x-0 md:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="mb-6 flex shrink-0 items-start justify-between gap-2 md:block">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pm-accent)] to-[var(--pm-accent-strong)] text-sm font-black text-white shadow-lg shadow-[rgba(79,122,101,0.25)]">
                PM
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[var(--pm-ink)]">PHONEMART</h1>
                <p className="text-[11px] font-medium text-[var(--pm-ink-soft)]">Admin &amp; POS</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--pm-ink-soft)] hover:bg-[var(--pm-surface-soft)] hover:text-[var(--pm-ink)] md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0">{SidebarBody}</div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--pm-border)] bg-[var(--pm-canvas)]/90 px-4 py-3 backdrop-blur-md md:hidden">
          <button
            type="button"
            className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] p-2 text-[var(--pm-ink-soft)] shadow-sm hover:bg-[var(--pm-surface-soft)] hover:text-[var(--pm-ink)]"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--pm-ink)]">PHONEMART</p>
            <p className="truncate text-xs text-[var(--pm-ink-soft)]">{currentShop?.name ?? "All locations"}</p>
          </div>
        </header>

        <main className="pm-page flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
