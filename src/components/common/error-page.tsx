import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { Home, LayoutDashboard, Loader2, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { StatusPage } from "@/components/common/status-page";
import { m } from "@/paraglide/messages";

export function ErrorPage({ reset }: { error?: Error; reset?: () => void }) {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const admin = /^\/admin(?:\/|$)/.test(pathname);
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retry = async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    setRetryFailed(false);
    try {
      // Clear failed loader matches before resetting a React render boundary.
      await router.invalidate({ sync: true });
      reset?.();
      if (router.state.matches.some((match) => match.status === "error"))
        setRetryFailed(true);
    } catch {
      setRetryFailed(true);
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  };
  return (
    <StatusPage
      code="500"
      title={m.error_title()}
      description={admin ? m.admin_error_desc() : m.error_desc()}
      action={
        <>
          <button
            type="button"
            className="fuwari-btn-primary"
            onClick={retry}
            disabled={retrying}
            aria-busy={retrying}
          >
            {retrying ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <RotateCw size={18} aria-hidden="true" />
            )}
            {retrying ? m.error_retrying() : m.error_retry()}
          </button>
          <Link to={admin ? "/admin" : "/"} className="fuwari-btn-regular">
            {admin ? (
              <LayoutDashboard size={18} aria-hidden="true" />
            ) : (
              <Home size={18} aria-hidden="true" />
            )}
            {admin ? m.error_back_dashboard() : m.not_found_return()}
          </Link>
          {retryFailed && (
            <p className="site-status-feedback" role="status">
              {m.error_retry_failed()}
            </p>
          )}
        </>
      }
    />
  );
}
