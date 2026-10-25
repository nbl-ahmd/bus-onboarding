"use client";
import { useEffect, useRef, type PointerEvent } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { AudioLines, Play, SlidersHorizontal } from "lucide-react";
import type { AnnouncementTemplate } from "@/domain/models";
import { AnnouncementIcon } from "./ui";
export function QuickAnnouncements({
  templates,
  onPlay,
  onEdit,
  playingId,
  disabled,
  gestures,
  readiness,
}: {
  templates: AnnouncementTemplate[];
  onPlay: (template: AnnouncementTemplate) => void;
  onEdit: (template: AnnouncementTemplate) => void;
  playingId: string | null;
  disabled: boolean;
  gestures: boolean;
  readiness: Record<string, boolean>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const identity = templates.map((t) => t.id).join(",");
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".quick-row",
          { y: 5 },
          {
            y: 0,
            duration: 0.2,
            stagger: 0.018,
            ease: "power2.out",
            clearProps: "transform",
          },
        );
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [identity] },
  );
  return (
    <div className="quick-list" ref={root}>
      {templates.map((template) => (
        <QuickRow
          key={template.id}
          template={template}
          onPlay={onPlay}
          onEdit={onEdit}
          active={playingId === template.id}
          disabled={disabled}
          gestures={gestures}
          ready={readiness[template.id]}
        />
      ))}
    </div>
  );
}
function QuickRow({
  template,
  onPlay,
  onEdit,
  active,
  disabled,
  gestures,
  ready,
}: {
  template: AnnouncementTemplate;
  onPlay: (template: AnnouncementTemplate) => void;
  onEdit: (template: AnnouncementTemplate) => void;
  active: boolean;
  disabled: boolean;
  gestures: boolean;
  ready?: boolean;
}) {
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current);
    },
    [],
  );
  function cancel() {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  }
  function down(event: PointerEvent<HTMLButtonElement>) {
    suppressClick.current = false;
    if (!gestures || disabled || event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY };
    press.current = setTimeout(() => {
      suppressClick.current = true;
      press.current = null;
      onEdit(template);
    }, 480);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (
      Math.abs(event.clientX - origin.current.x) > 10 ||
      Math.abs(event.clientY - origin.current.y) > 10
    ) {
      cancel();
      suppressClick.current = true;
    }
  }
  return (
    <article className={`quick-row ${active ? "active" : ""}`}>
      <button
        className="quick-play"
        disabled={disabled}
        aria-label={`Play ${template.title}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={cancel}
        onPointerCancel={() => {
          cancel();
          suppressClick.current = true;
        }}
        onPointerLeave={cancel}
        onContextMenu={(e) => {
          if (gestures) e.preventDefault();
        }}
        onClick={(event) => {
          cancel();
          if (suppressClick.current && event.detail !== 0) {
            suppressClick.current = false;
            return;
          }
          onPlay(template);
        }}
      >
        <span
          className={`quick-symbol ${template.category === "Updates" ? "amber" : ""}`}
        >
          <AnnouncementIcon name={template.icon} size={22} />
        </span>
        <span className="quick-copy">
          <strong>{template.title}</strong>
          <span>{active ? "Playing your sequence" : template.description}</span>
        </span>
        <span className="quick-state">
          {active ? (
            <AudioLines size={20} />
          ) : (
            <>
              <small className={ready ? "ready" : ""}>
                {ready === undefined ? "" : ready ? "Ready" : "Add audio"}
              </small>
              <Play size={18} fill="currentColor" />
            </>
          )}
        </span>
      </button>
      <button
        className="quick-edit"
        aria-label={`Edit ${template.title}`}
        disabled={disabled}
        onClick={() => {
          cancel();
          onEdit(template);
        }}
      >
        <SlidersHorizontal size={17} />
      </button>
    </article>
  );
}
