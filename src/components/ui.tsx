"use client";
import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  Bus,
  Hand,
  Route,
  ShieldCheck,
  Coffee,
  Clock3,
  Pause,
  TrafficCone,
  Moon,
  MapPin,
  Flag,
  Heart,
  Mic2,
  type LucideIcon,
} from "lucide-react";
const icons: Record<string, LucideIcon> = {
  bus: Bus,
  hand: Hand,
  route: Route,
  shield: ShieldCheck,
  coffee: Coffee,
  clock: Clock3,
  pause: Pause,
  traffic: TrafficCone,
  moon: Moon,
  pin: MapPin,
  flag: Flag,
  heart: Heart,
  mic: Mic2,
};
export function AnnouncementIcon({
  name,
  size = 23,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name] || Mic2;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const handler = (event: Event) => {
      event.preventDefault();
      close.current();
    };
    el?.addEventListener("cancel", handler);
    return () => {
      el?.removeEventListener("cancel", handler);
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${wide ? "wide" : ""}`}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EmptyState({
  icon: Icon = Route,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={32} strokeWidth={1.5} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export function DownloadLink({
  data,
  name,
  label,
}: {
  data: unknown;
  name: string;
  label: ReactNode;
}) {
  return (
    <button
      className="button secondary"
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      {label}
    </button>
  );
}
