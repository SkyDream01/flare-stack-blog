import { Link, useRouteContext } from "@tanstack/react-router";
import {
  FileText,
  Home,
  Link2,
  LogIn,
  LogOut,
  Rss,
  Settings,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { NavOption, UserInfo } from "@/features/theme/contract/layouts";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface DrawerProps {
  navOptions: Array<NavOption>;
  isOpen: boolean;
  onClose: () => void;
  user?: UserInfo;
  logout: () => Promise<void>;
}

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  home: Home,
  posts: FileText,
  "friend-links": Link2,
};

/**
 * 左侧抽屉(对应原主题 .mdui-drawer):
 * 头像 + 导航列表 + 登录/退出。
 */
export function Drawer({
  navOptions,
  isOpen,
  onClose,
  user,
  logout,
}: DrawerProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.documentElement.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return (
    <>
      {/* 遮罩 */}
      <div
        className={cn(
          "cuckoo-drawer-backdrop fixed inset-0 z-55 bg-black/40",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label={m.common_open_menu()}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key !== "Tab") return;
          const items = panelRef.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not(:disabled)",
          );
          const first = items?.[0];
          const last = items?.[items.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panelRef.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className={cn(
          "cuckoo-drawer fixed top-0 bottom-0 left-0 z-60 flex w-72 max-w-[85vw] flex-col outline-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: "var(--cuckoo-drawer-bg)" }}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <button
          type="button"
          onClick={onClose}
          className="cuckoo-appbar-icon cuckoo-text-75 absolute top-2 right-2"
          aria-label={m.common_close()}
        >
          <X size={18} />
        </button>
        {/* 头像(对应原主题 .drawer-img) */}
        <div className="flex justify-center pt-6">
          <div className="h-24 w-24 overflow-hidden rounded-full shadow-md">
            {siteConfig.theme.cuckoo.avatar ? (
              <img
                src={siteConfig.theme.cuckoo.avatar}
                alt={siteConfig.title}
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-(--cuckoo-btn-regular-bg) text-(--cuckoo-text-50)">
                <UserIcon size={40} strokeWidth={1.25} />
              </div>
            )}
          </div>
        </div>
        <div className="cuckoo-text-90 mt-3 truncate px-6 text-center text-lg font-medium">
          {siteConfig.title}
        </div>
        {siteConfig.description && (
          <div className="cuckoo-text-50 mt-1 line-clamp-2 px-8 text-center text-xs leading-relaxed">
            {siteConfig.description}
          </div>
        )}

        <div
          className="mx-6 mt-4 border-t"
          style={{ borderColor: "var(--cuckoo-divider)" }}
        />

        {/* 导航列表(对应原主题 .drawer-list) */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {navOptions.map((option) => {
            const Icon = NAV_ICONS[option.id] ?? FileText;
            return (
              <Link
                key={option.id}
                to={option.to}
                onClick={onClose}
                className="cuckoo-text-75 hover:bg-(--cuckoo-btn-regular-bg-hover) hover:text-(--cuckoo-accent) flex items-center gap-4 rounded-md px-4 py-3 text-sm transition-colors"
                activeProps={{
                  className:
                    "!text-[var(--cuckoo-accent)] !bg-[var(--cuckoo-btn-regular-bg)]",
                }}
              >
                <Icon size={18} />
                <span className="truncate">{option.label}</span>
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <Link
              to="/admin"
              onClick={onClose}
              className="cuckoo-text-75 hover:bg-(--cuckoo-btn-regular-bg-hover) hover:text-(--cuckoo-accent) flex items-center gap-4 rounded-md px-4 py-3 text-sm transition-colors"
            >
              <Settings size={18} />
              <span className="truncate">{m.profile_admin_dashboard()}</span>
            </Link>
          )}

          {user ? (
            <button
              type="button"
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="cuckoo-text-75 hover:bg-(--cuckoo-btn-regular-bg-hover) hover:text-red-500 flex w-full items-center gap-4 rounded-md px-4 py-3 text-sm transition-colors"
            >
              <LogOut size={18} />
              <span className="truncate">{m.profile_logout()}</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="cuckoo-text-75 hover:bg-(--cuckoo-btn-regular-bg-hover) hover:text-(--cuckoo-accent) flex items-center gap-4 rounded-md px-4 py-3 text-sm transition-colors"
            >
              <LogIn size={18} />
              <span className="truncate">{m.nav_login_register()}</span>
            </Link>
          )}
        </nav>

        {/* 底部信息(对应原主题 .drawer-bottom) */}
        <div
          className="cuckoo-text-50 shrink-0 border-t px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs"
          style={{ borderColor: "var(--cuckoo-divider)" }}
        >
          <a
            href="/rss.xml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-(--cuckoo-accent)"
          >
            <Rss size={12} />
            RSS
          </a>
        </div>
      </aside>
    </>
  );
}
