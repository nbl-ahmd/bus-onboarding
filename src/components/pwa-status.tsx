"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
export function PwaStatus({
  online,
  blocked,
  notify,
}: {
  online: boolean;
  blocked: boolean;
  notify: (message: string) => void;
}) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    let alive = true;
    let registration: ServiceWorkerRegistration | undefined;
    let applying = false;
    const changed = () => {
      if (applying) window.location.reload();
    };
    const apply = () => {
      applying = true;
    };
    window.addEventListener("nightline:apply-update", apply);
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    const check = () => {
      void registration?.update().catch(() => {});
    };
    navigator.serviceWorker
      .register("/sw.js")
      .then((worker) => {
        registration = worker;
        if (!alive) return;
        setWaiting(worker.waiting);
        setOfflineReady(Boolean(worker.active));
        worker.addEventListener("updatefound", () => {
          const installing = worker.installing;
          installing?.addEventListener("statechange", () => {
            if (!alive) return;
            if (installing.state === "installed") {
              setOfflineReady(true);
              if (navigator.serviceWorker.controller) setWaiting(installing);
            }
          });
        });
      })
      .catch(() =>
        notify(
          "Offline setup failed. Reopen while connected before departure.",
        ),
      );
    window.addEventListener("online", check);
    return () => {
      alive = false;
      window.removeEventListener("online", check);
      window.removeEventListener("nightline:apply-update", apply);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
    };
  }, [notify]);
  if (waiting)
    return (
      <div className="pwa-status">
        <RefreshCw size={16} />
        <span>
          A new version is ready. Your saved trip and audio stay on this phone.
        </span>
        <button
          className="text-button"
          disabled={blocked}
          onClick={() => {
            window.dispatchEvent(new Event("nightline:apply-update"));
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          Update app
        </button>
      </div>
    );
  if (!online)
    return (
      <div className="pwa-status">
        <WifiOff size={16} />
        <span>
          Offline · saved trips and downloaded audio are available. Summary uses
          reusable details.
        </span>
      </div>
    );
  if (!offlineReady) return null;
  return (
    <div className="offline-shell-ready">
      <Download size={13} /> App saved on this phone · download trip voices
      before departure
    </div>
  );
}
