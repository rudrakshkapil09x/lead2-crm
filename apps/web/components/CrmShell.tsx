"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UsersRound,
  Columns3,
  CheckSquare2,
  FileText,
  Settings2,
  BookOpen,
  LogOut,
  Search,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { api, setSession, can, signOut } from "../lib/api";
import { Avatar, Loading } from "./UI";
const links = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: UsersRound },
  { name: "Pipeline", href: "/pipeline", icon: Columns3 },
  { name: "Tasks", href: "/tasks", icon: CheckSquare2 },
  { name: "Proposals", href: "/proposals", icon: FileText },
];
export default function CrmShell({ children }: { children: React.ReactNode }) {
  const [u, setU] = useState<any>(null),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const path = usePathname();
  useEffect(() => {
    api("/auth/me")
      .then((x) => {
        if (x.platformAdmin && !x.tenantId) {
          location.href = "/super-admin";
          return;
        }
        if (x.mustChangePassword && path !== "/account") {
          location.href = "/account";
          return;
        }
        setSession(x);
        setU(x);
      })
      .catch(() => (location.href = "/login"));
  }, [path]);
  useEffect(() => setOpen(false), [path]);
  if (!u) return <Loading />;
  const setup = [
    ...(can(u, "team.manage") || can(u, "user.manage")
      ? [{ name: "Team & access", href: "/team", icon: UsersRound }]
      : []),
    ...(can(u, "commercial.manage") || can(u, "template.manage")
      ? [{ name: "Commercials", href: "/commercials", icon: BookOpen }]
      : []),
    ...(can(u, "pipeline.manage")
      ? [{ name: "Workspace settings", href: "/admin", icon: Settings2 }]
      : []),
  ];
  const nav = (items: any[]) =>
    items.map((x) => (
      <Link
        key={x.href}
        className={path.startsWith(x.href) ? "active" : ""}
        href={x.href}
      >
        <x.icon size={19} />
        <span>{x.name}</span>
        {path === x.href && <i />}
      </Link>
    ));
  return (
    <div className="shell">
      {open && (
        <button
          className="side-shade"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "opened" : ""}`}>
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            L<span>2</span>
          </span>
          <span>
            Lead2<span className="brand-crm">CRM</span>
          </span>
        </Link>
        <div className="workspace-card">
          <span className="workspace-icon">
            <Building2 size={18} />
          </span>
          <div>
            <b>{u.tenantName}</b>
            <small>Client workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>{nav(links)}</nav>
        {setup.length > 0 && (
          <>
            <div className="nav-label">MANAGE</div>
            <nav>{nav(setup)}</nav>
          </>
        )}
        <div className="sidebar-bottom">
          {u.platformAdmin && (
            <button
              className="support-back"
              onClick={async () => {
                await api("/auth/super-admin/context", {
                  method: "POST",
                  body: "{}",
                });
                location.href = "/super-admin";
              }}
            >
              <ShieldCheck size={17} />
              Lead2 control center
              <ArrowUpRight size={15} />
            </button>
          )}
          <div className="workspace-note">
            <span className="live-dot" />{" "}
            {u.roleCode === "client_manager"
              ? "Your team’s workspace"
              : u.roleCode === "sales_member"
                ? "Your sales workspace"
                : "Workspace administration"}
          </div>
          <Link className="profile" href="/account">
            <Avatar name={u.name} />
            <div>
              <b>{u.name}</b>
              <small>{u.role}</small>
            </div>
          </Link>
          <button className="logout" onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <b>
                {[...links, ...setup].find((x) => path.startsWith(x.href))
                  ?.name || "Account"}
              </b>
            </span>
          </div>
          <form className="global-search" action="/leads">
            <Search size={17} />
            <input
              name="q"
              aria-label="Search leads"
              placeholder="Search leads or companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <Link className="top-avatar" href="/account" aria-label="My account">
            <Avatar name={u.name} small />
          </Link>
        </header>
        <main className="main" id="main-content">
          {u.platformAdmin && (
            <div className="engineer-banner">
              <ShieldCheck size={17} />
              Engineer access · {u.tenantName} · All changes are recorded.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
