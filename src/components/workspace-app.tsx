"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Bell,
  Bluetooth,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Download,
  Edit3,
  History,
  LoaderCircle,
  LogOut,
  Menu,
  Mic2,
  Moon,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Repeat2,
  SlidersHorizontal,
  Route,
  Save,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  Square,
  Star,
  Sun,
  Users,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import {
  languagesFor,
  tripSchema,
  uid,
  type AnnouncementEvent,
  type AnnouncementFacts,
  type AnnouncementTemplate,
  type Category,
  type Language,
  type Page,
  type Preferences,
  type Trip,
} from "@/domain/models";
import {
  estimatedSeconds,
  formatArrival,
  ManualAnnouncementTrigger,
  renderAnnouncement,
  type TriggerEvent,
} from "@/domain/announcements";
import { createWorkspace } from "@/domain/seed";
import {
  getPlaybackReadiness,
  buildPlaybackSequence,
  playbackSequenceLabel,
} from "@/domain/playback";
import { haptics } from "@/adapters/haptics";
import { SequenceDialog } from "./playback-sequence";
import { QuickAnnouncements } from "./quick-announcements";
import { audioKey, audioRepository } from "@/adapters/storage";
import {
  BrowserPlaybackAdapter,
  findAudio,
  GeminiSpeechProvider,
} from "@/adapters/speech";
import { MetNorwayWeatherProvider } from "@/adapters/weather";
import { getSupabase } from "@/adapters/supabase";
import { useWorkspace } from "@/lib/use-workspace";
import {
  AnnouncementIcon,
  Dialog,
  DownloadLink,
  EmptyState,
  errorMessage,
} from "./ui";
import { TripEditor } from "./trip-editor";
import { AccountDialog } from "./account-dialog";
import { FleetPanel } from "./fleet-panel";
import { SettingsPanel } from "./settings-panel";
import { RecordDialog } from "./record-dialog";
import { AudioLibrary } from "./audio-library";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const sections: {
  id: Page;
  title: string;
  icon: typeof Radio;
  description: string;
}[] = [
  {
    id: "announcements",
    title: "Announcements",
    icon: Radio,
    description: "The right words, at the right moment.",
  },
  {
    id: "trips",
    title: "Your trips",
    icon: Route,
    description: "A little preparation. A smoother journey.",
  },
  {
    id: "library",
    title: "Audio library",
    icon: AudioLines,
    description: "Your familiar voice, even when you’re offline.",
  },
  {
    id: "history",
    title: "Activity",
    icon: History,
    description: "A record of what your passengers heard.",
  },
  {
    id: "fleet",
    title: "Fleet & crew",
    icon: Users,
    description: "The people and buses behind every journey.",
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings2,
    description: "Make Nightline work for your bus.",
  },
];
const languageLabels: Record<Preferences["languageMode"], string> = {
  "ml-en": "Malayalam + English",
  "en-ml": "English + Malayalam",
  ml: "Malayalam",
  en: "English",
};
const initialFacts: AnnouncementFacts = {
  delayMinutes: 0,
  breakMinutes: undefined,
  reason: "unspecified",
  stopName: "",
  revisedArrival: "",
};
export function WorkspaceApp() {
  const {
    workspace: w,
    identity,
    online,
    config,
    busy: syncing,
    notice,
    setNotice,
    update,
    connectCloud,
    sync,
    disconnect,
  } = useWorkspace();
  const [page, setPage] = useState<Page>("announcements");
  const [category, setCategory] = useState<Category>("All announcements");
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(true);
  const [selectedId, setSelectedId] = useState("welcome");
  const [showPreview, setShowPreview] = useState(false);
  const [factOverrides, setFactOverrides] = useState<
    Record<string, AnnouncementFacts>
  >({});
  const facts = factOverrides[selectedId] || initialFacts;
  function setFacts(
    next:
      AnnouncementFacts | ((previous: AnnouncementFacts) => AnnouncementFacts),
  ) {
    setFactOverrides((previous) => ({
      ...previous,
      [selectedId]:
        typeof next === "function"
          ? next(previous[selectedId] || initialFacts)
          : next,
    }));
  }
  const [editor, setEditor] = useState<Trip | null>(null);
  const [account, setAccount] = useState(false);
  const [record, setRecord] = useState(false);
  const [help, setHelp] = useState(false);
  const [audioTest, setAudioTest] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [custom, setCustom] = useState(false);
  const [menu, setMenu] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<Language>("en");
  const [editingScript, setEditingScript] = useState(false);
  const [overrides, setOverrides] = useState<{
    key: string;
    en: string;
    ml: string;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playingLanguage, setPlayingLanguage] = useState<Language>("en");
  const [playingTitle, setPlayingTitle] = useState("");
  const [generation, setGeneration] = useState("");
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioVersion, setAudioVersion] = useState(0);
  const [cachedReady, setCachedReady] = useState<{
    key: string;
    languages: Language[];
  }>({ key: "", languages: [] });
  const [preparePack, setPreparePack] = useState(false);
  const [packAll, setPackAll] = useState(false);
  const [sequenceDialog, setSequenceDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [playingStep, setPlayingStep] = useState({ index: 0, total: 1 });
  const [playingTemplateId, setPlayingTemplateId] = useState<string | null>(
    null,
  );
  const [quickReadiness, setQuickReadiness] = useState<Record<string, boolean>>(
    {},
  );
  const quickPending = useRef(false);
  const playbackCancelled = useRef(false);
  const playerSwipe = useRef<{ x: number; y: number } | null>(null);
  const sheetSwipe = useRef<{ x: number; y: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const operation = useRef<"play" | "generate" | null>(null);
  const previewPanel = useRef<HTMLElement>(null);
  const player = useRef<BrowserPlaybackAdapter | null>(null);
  const abort = useRef<AbortController | null>(null);
  const trigger = useRef(new ManualAnnouncementTrigger());
  const playRef = useRef<(event: TriggerEvent) => void>(() => {});
  const importInput = useRef<HTMLInputElement>(null);
  const trip = w?.trips.find((t) => t.id === w.activeTripId) || w?.trips[0];
  const selected =
    w?.templates.find((t) => t.id === selectedId) || w?.templates[0];
  const fleetId = w?.fleet.id || "";
  const variant = `gemini:${config.model}:${config.voice}`;
  const effectiveFacts =
    selected && trip
      ? templateFacts(selected, trip, facts)
      : { ...facts, stopName: facts.stopName };
  const scriptKey = JSON.stringify([
    selected?.id,
    trip?.updatedAt,
    w?.fleet.name,
    effectiveFacts,
  ]);
  const texts: Record<Language, string> =
    selected && trip && w
      ? {
          en: renderAnnouncement(
            selected,
            trip,
            w.fleet.name,
            effectiveFacts,
            "en",
          ),
          ml: renderAnnouncement(
            selected,
            trip,
            w.fleet.name,
            effectiveFacts,
            "ml",
          ),
        }
      : { en: "", ml: "" };
  const scripts =
    overrides?.key === scriptKey
      ? { en: overrides.en, ml: overrides.ml }
      : texts;
  const en = scripts.en;
  const ml = scripts.ml;
  const audioIdentity = JSON.stringify([en, ml, fleetId, variant]);
  const ready = cachedReady.key === audioIdentity ? cachedReady.languages : [];
  const prefs = w?.preferences;
  const languageMode = prefs?.languageMode || "en-ml";
  const sequence = buildPlaybackSequence(
    languageMode,
    prefs?.repetitions,
    prefs?.repeatPattern,
  );
  const requestedLanguages = languagesFor(languageMode);
  const allReady = requestedLanguages.every((l) => ready.includes(l));
  const isAdmin = !identity || identity.role === "admin";
  useEffect(() => {
    player.current = new BrowserPlaybackAdapter();
    return () => {
      player.current?.stop();
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() || []);
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);
  useEffect(() => {
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    queueMicrotask(() =>
      setInstalled(window.matchMedia("(display-mode: standalone)").matches),
    );
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all(
      (["en", "ml"] as const).map(async (language) => ({
        language,
        audio: await findAudio(
          language === "en" ? en : ml,
          language,
          fleetId,
          variant,
        ),
      })),
    )
      .then((results) => {
        if (alive)
          setCachedReady({
            key: audioIdentity,
            languages: results.filter((r) => r.audio).map((r) => r.language),
          });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [en, ml, fleetId, variant, audioVersion, audioIdentity]);
  useEffect(() => {
    if (!w || !trip) return;
    let alive = true;
    Promise.all(
      w.templates.map(async (template) => {
        const resolvedFacts = templateFacts(
          template,
          trip,
          factOverrides[template.id] || initialFacts,
        );
        const key = JSON.stringify([
          template.id,
          trip.updatedAt,
          w.fleet.name,
          resolvedFacts,
        ]);
        const spoken =
          overrides?.key === key
            ? { en: overrides.en, ml: overrides.ml }
            : {
                en: renderAnnouncement(
                  template,
                  trip,
                  w.fleet.name,
                  resolvedFacts,
                  "en",
                ),
                ml: renderAnnouncement(
                  template,
                  trip,
                  w.fleet.name,
                  resolvedFacts,
                  "ml",
                ),
              };
        const langs = languagesFor(w.preferences.languageMode);
        const files = await Promise.all(
          langs.map(async (language) => ({
            language,
            audio: await findAudio(
              spoken[language],
              language,
              w.fleet.id,
              variant,
            ),
          })),
        );
        return [
          template.id,
          getPlaybackReadiness(
            langs,
            files.filter((file) => file.audio).map((file) => file.language),
            voices.map((voice) => voice.lang),
            w.preferences.speechProvider,
          ).canPlay,
        ] as const;
      }),
    )
      .then((entries) => {
        if (alive) setQuickReadiness(Object.fromEntries(entries));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [w, trip, factOverrides, variant, voices, audioVersion, overrides]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  useEffect(() => {
    if (w)
      document.documentElement.dataset.theme = w.preferences.nightMode
        ? "dark"
        : "light";
  }, [w?.preferences.nightMode, w]);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    async function acquire() {
      if (
        disposed ||
        !prefs?.keepAwake ||
        trip?.status !== "active" ||
        document.visibilityState !== "visible" ||
        !navigator.wakeLock
      )
        return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (disposed) {
          await lock.release();
          return;
        }
        setWakeActive(true);
        lock.addEventListener("release", () => setWakeActive(false));
      } catch {
        setWakeActive(false);
      }
    }
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", acquire);
      setWakeActive(false);
    };
  }, [prefs?.keepAwake, trip?.status]);
  useEffect(() => {
    if (!showPreview) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        previewPanel.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        setShowPreview(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", key);
      previousFocus?.focus();
    };
  }, [showPreview]);
  useEffect(
    () => trigger.current.subscribe((event) => playRef.current(event)),
    [],
  );
  const notify = useCallback(
    (message: string) => setNotice(message),
    [setNotice],
  );
  function openAccount() {
    if (operation.current) {
      notify(
        "Finish or stop the current audio operation before changing accounts.",
      );
      return;
    }
    setAccount(true);
  }
  function preferences(p: Preferences) {
    return update((s) => ({ ...s, preferences: p }));
  }
  function selectAnnouncement(template: AnnouncementTemplate) {
    if (playing || generation) return;
    haptics.pulse("tap", prefs?.haptics ?? true);
    setSelectedId(template.id);
    setShowPreview(true);
    setEditingScript(false);
  }
  function saveTrip(next: Trip) {
    update(
      (s) => ({
        ...s,
        trips: [...s.trips.filter((t) => t.id !== next.id), next],
        activeTripId: next.id,
      }),
      { kind: "trip", id: next.id, payload: next },
    );
    setFactOverrides({});
    setEditor(null);
    notify(
      "Trip saved on this phone. Your announcements now use these details.",
    );
  }
  function newTrip(reverse = false) {
    if (!w) return;
    const base = trip || createWorkspace().trips[0];
    setEditor({
      ...base,
      id: uid(),
      fleetId: w.fleet.id,
      driverId: identity?.id || w.drivers[0]?.id || base.driverId,
      vehicleId: w.vehicles[0]?.id || "",
      origin: reverse ? base.destination : base.origin,
      destination: reverse ? base.origin : base.destination,
      stops: reverse ? [...base.stops].reverse() : structuredClone(base.stops),
      status: "scheduled",
      sample: base.sample ?? false,
    });
  }
  function changeTrip(id: string) {
    if (playing || generation) return;
    update((s) => ({ ...s, activeTripId: id }));
    setFactOverrides({});
  }
  function statusTrip() {
    if (!trip) return;
    if (trip.sample) {
      setEditor(trip);
      notify("Confirm the real timetable and trip details before starting.");
      return;
    }
    const next = {
      ...trip,
      status:
        trip.status === "active" ? ("completed" as const) : ("active" as const),
      updatedAt: new Date().toISOString(),
    };
    if (
      next.status === "active" &&
      w?.trips.some((t) => t.status === "active" && t.id !== next.id)
    ) {
      notify("End the current active trip before starting another.");
      return;
    }
    saveTrip(next);
    notify(
      next.status === "active"
        ? "Trip started. Choose an announcement when you are ready."
        : "Trip completed. Your activity is saved on this phone.",
    );
  }
  async function playAnnouncement(triggerEvent: TriggerEvent) {
    const template = w?.templates.find((t) => t.id === triggerEvent.templateId);
    if (!w || !trip || !template || playing || generation || operation.current)
      return;
    operation.current = "play";
    playbackCancelled.current = false;
    const playbackScripts = triggerEvent.scripts || {
      en: renderAnnouncement(
        template,
        trip,
        w.fleet.name,
        triggerEvent.facts,
        "en",
      ),
      ml: renderAnnouncement(
        template,
        trip,
        w.fleet.name,
        triggerEvent.facts,
        "ml",
      ),
    };
    setPlayingTemplateId(template.id);
    setPlayingStep({ index: 0, total: sequence.length });
    setPlaying(true);
    setPlayingTitle(template.title);
    let source: AnnouncementEvent["source"] = "saved-audio";
    let status: AnnouncementEvent["status"] = "played";
    let detail = "";
    try {
      const items = await Promise.all(
        languagesFor(w.preferences.languageMode).map(async (language) => {
          const text = playbackScripts[language];
          if (!text.trim())
            throw new Error(
              "The announcement is empty. Add a script before playing.",
            );
          const cached = await findAudio(text, language, w.fleet.id, variant);
          if (!cached) {
            if (w.preferences.speechProvider === "gemini")
              throw new Error(
                "Prepare this announcement’s audio first, or select device voices in Settings.",
              );
            const exists = voices.some((v) =>
              v.lang.toLowerCase().startsWith(language),
            );
            if (!exists)
              throw new Error(
                `${language === "ml" ? "Malayalam" : "English"} voice is not available on this phone. Add a recording, prepare Gemini audio, or change languages in Settings.`,
              );
            source = "device";
          }
          return { text, language, blob: cached?.blob };
        }),
      );
      if (playbackCancelled.current) throw new Error("STOPPED");
      const scheduledItems = buildPlaybackSequence(
        w.preferences.languageMode,
        w.preferences.repetitions,
        w.preferences.repeatPattern,
      ).map((language) => items.find((item) => item.language === language)!);
      await player.current!.play(
        scheduledItems,
        w.preferences,
        (language, index, total) => {
          setPlayingLanguage(language);
          setPlayingStep({ index, total });
        },
      );
      haptics.pulse("complete", w.preferences.haptics);
      notify("Announcement completed.");
    } catch (err) {
      detail = errorMessage(err);
      status = detail === "STOPPED" ? "stopped" : "failed";
      if (status === "failed") notify(detail);
    } finally {
      operation.current = null;
      setPlaying(false);
      setPlayingTemplateId(null);
      const event: AnnouncementEvent = {
        id: uid(),
        tripId: trip.id,
        fleetId: w.fleet.id,
        driverId: identity?.id || trip.driverId,
        templateId: template.id,
        title: template.title,
        languageMode: w.preferences.languageMode,
        sequence: buildPlaybackSequence(
          w.preferences.languageMode,
          w.preferences.repetitions,
          w.preferences.repeatPattern,
        ),
        at: new Date().toISOString(),
        status,
        source,
        detail: detail === "STOPPED" ? "Stopped by crew" : detail,
        trigger: triggerEvent.source,
      };
      update((s) => ({ ...s, events: [event, ...s.events].slice(0, 500) }), {
        kind: "event",
        id: event.id,
        payload: event,
      });
    }
  }
  useEffect(() => {
    playRef.current = (event) => {
      void playAnnouncement(event);
    };
  });
  function stopPlayback() {
    playbackCancelled.current = true;
    haptics.pulse("stop", prefs?.haptics ?? true);
    player.current?.stop();
  }
  function requestPlay() {
    if (!selected || operation.current || quickPending.current) return;
    haptics.pulse("play", prefs?.haptics ?? true);
    trigger.current.dispatch(selected.id, effectiveFacts, scripts);
    setShowPreview(false);
  }
  async function quickPlay(template: AnnouncementTemplate) {
    if (!w || !trip || operation.current || quickPending.current) return;
    quickPending.current = true;
    haptics.pulse("play", w.preferences.haptics);
    const resolvedFacts = templateFacts(
      template,
      trip,
      factOverrides[template.id] || initialFacts,
    );
    const key = JSON.stringify([
      template.id,
      trip.updatedAt,
      w.fleet.name,
      resolvedFacts,
    ]);
    const spoken =
      overrides?.key === key
        ? { en: overrides.en, ml: overrides.ml }
        : {
            en: renderAnnouncement(
              template,
              trip,
              w.fleet.name,
              resolvedFacts,
              "en",
            ),
            ml: renderAnnouncement(
              template,
              trip,
              w.fleet.name,
              resolvedFacts,
              "ml",
            ),
          };
    try {
      const languages = languagesFor(w.preferences.languageMode);
      const files = await Promise.all(
        languages.map(async (language) => ({
          language,
          audio: await findAudio(
            spoken[language],
            language,
            w.fleet.id,
            variant,
          ),
        })),
      );
      const detected = window.speechSynthesis?.getVoices() || voices;
      const state = getPlaybackReadiness(
        languages,
        files.filter((item) => item.audio).map((item) => item.language),
        detected.map((voice) => voice.lang),
        w.preferences.speechProvider,
      );
      setSelectedId(template.id);
      if (!state.canPlay) {
        setShowPreview(true);
        setEditingScript(false);
        notify(
          `Add ${state.missing.map((l) => (l === "en" ? "English" : "Malayalam")).join(" and ")} audio once to enable one-tap playback.`,
        );
        return;
      }
      trigger.current.dispatch(template.id, resolvedFacts, spoken);
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      quickPending.current = false;
    }
  }
  function navigate(next: Page) {
    if (playing && next === "library") {
      notify("Stop the announcement before opening the audio library.");
      return;
    }
    setPage(next);
    setShowPreview(false);
    setMenu(false);
  }
  async function generate(list: AnnouncementTemplate[]) {
    if (!w || !trip || generation || playing || operation.current) return;
    if (!config.gemini) {
      notify(
        "Gemini is not connected. Add your own recordings or configure the server API key.",
      );
      return;
    }
    operation.current = "generate";
    const controller = new AbortController();
    abort.current = controller;
    let count = 0;
    let downloaded = 0;
    try {
      for (const template of list)
        for (const language of languagesFor(w.preferences.languageMode)) {
          if (controller.signal.aborted)
            throw new Error(
              "Preparation cancelled. Completed files remain saved.",
            );
          const text =
            list.length === 1 && template.id === selected?.id
              ? scripts[language]
              : renderAnnouncement(
                  template,
                  trip,
                  w.fleet.name,
                  effectiveFacts,
                  language,
                );
          if (await findAudio(text, language, w.fleet.id, variant)) continue;
          setGeneration(
            `${template.title} · ${language === "ml" ? "Malayalam" : "English"}`,
          );
          const key = await audioKey(text, language, variant, w.fleet.id);
          const remote =
            identity && online
              ? await getSupabase()!
                  .storage.from("announcements")
                  .download(`${w.fleet.id}/${key}.wav`)
              : null;
          const blob =
            remote?.data ||
            (await new GeminiSpeechProvider().synthesize(
              text,
              language,
              controller.signal,
            ));
          if (remote?.data) downloaded++;
          await audioRepository.put({
            key,
            blob,
            language,
            text,
            fleetId: w.fleet.id,
            title: template.title,
            createdAt: new Date().toISOString(),
            origin: "gemini",
          });
          count++;
          setAudioVersion((v) => v + 1);
          if (identity && getSupabase() && !remote?.data) {
            const result = await getSupabase()!
              .storage.from("announcements")
              .upload(`${w.fleet.id}/${key}.wav`, blob, {
                upsert: true,
                contentType: "audio/wav",
              });
            if (result.error)
              notify(
                "Audio saved on this phone. Cloud audio upload failed; you can still play it offline.",
              );
          }
        }
      notify(
        count
          ? `${count} ${count === 1 ? "voice file" : "voice files"} saved for offline playback.${downloaded ? ` ${downloaded} reused from your fleet’s audio.` : ""}`
          : "All selected announcements are already saved on this phone.",
      );
      setPreparePack(false);
    } catch (err) {
      notify(
        controller.signal.aborted
          ? "Preparation cancelled. Completed files remain saved."
          : errorMessage(err),
      );
    } finally {
      operation.current = null;
      setGeneration("");
      abort.current = null;
      setAudioVersion((v) => v + 1);
    }
  }
  async function weather() {
    if (!trip) return;
    setWeatherBusy(true);
    try {
      const result = await new MetNorwayWeatherProvider().forecast(trip);
      setFacts((f) => ({ ...f, weather: result }));
      notify("Forecast updated for the scheduled arrival time.");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setWeatherBusy(false);
    }
  }
  async function install() {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }
  async function importTrip(file: File) {
    if (!w) return;
    try {
      if (file.size > 100_000)
        throw new Error("Choose a trip JSON file smaller than 100 KB.");
      const data = JSON.parse(await file.text());
      const raw = data.trip || data;
      const parsed = tripSchema.safeParse({
        ...raw,
        id: uid(),
        fleetId: w.fleet.id,
        vehicleId: w.vehicles[0]?.id || "",
        driverId: identity?.id || w.drivers[0]?.id || "",
        status: "scheduled",
        updatedAt: new Date().toISOString(),
        sample: false,
      });
      if (!parsed.success)
        throw new Error("This file does not contain a valid Nightline trip.");
      setEditor(parsed.data);
    } catch (err) {
      notify(errorMessage(err));
    }
  }
  if (!w)
    return (
      <div className="loading-screen">
        <span className="brand-symbol">
          N<span />
        </span>
        <LoaderCircle className="spin" size={24} />
        <p>Getting your workspace ready…</p>
      </div>
    );
  const section = sections.find((s) => s.id === page)!;
  const vehicle = w.vehicles.find((v) => v.id === trip?.vehicleId);
  const filtered = w.templates.filter(
    (t) =>
      (!onlyFavorites || prefs!.favoriteIds.includes(t.id)) &&
      (category === "All announcements" || t.category === category) &&
      `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const factsNeeded =
    selected &&
    [
      "break",
      "congestion",
      "unscheduled",
      "approaching",
      "arrival",
      "summary",
    ].includes(selected.id);
  const readiness = getPlaybackReadiness(
    requestedLanguages,
    ready,
    voices.map((v) => v.lang),
    prefs!.speechProvider,
  );
  const missingNames = readiness.missing
    .map((l) => (l === "ml" ? "Malayalam" : "English"))
    .join(" + ");
  const tripTitle = trip
    ? `${trip.origin} to ${trip.destination}`
    : "No trip selected";
  return (
    <div className="app-shell quick-ui">
      <div className="main-shell">
        <header className="topbar">
          <button
            className="brand compact-brand"
            onClick={() => navigate("announcements")}
            aria-label="Nightline home"
          >
            <span className="brand-symbol">
              N<span />
            </span>
            <span>nightline</span>
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            {sections.slice(0, 3).map(({ id, title }) => (
              <button
                key={id}
                aria-current={page === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                {title}
              </button>
            ))}
          </nav>
          <div className="topbar-actions">
            {!online ? (
              <span className="network-status warning">
                <WifiOff size={15} />
                Offline
              </span>
            ) : (
              <span
                className="connection-dot"
                aria-label="Online"
                title="Online"
              />
            )}
            {identity ? (
              <button
                className="icon-button"
                aria-label="Sync fleet"
                disabled={!online || syncing}
                onClick={() => sync().catch((err) => notify(errorMessage(err)))}
              >
                <RefreshCw size={18} className={syncing ? "spin" : ""} />
              </button>
            ) : (
              <button className="pilot-account" onClick={openAccount}>
                Local pilot
              </button>
            )}
            <button
              className="icon-button"
              aria-label={
                prefs!.nightMode ? "Use day appearance" : "Use night appearance"
              }
              onClick={() =>
                preferences({ ...prefs!, nightMode: !prefs!.nightMode })
              }
            >
              {prefs!.nightMode ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{section.title}</h1>
              <p>
                {page === "announcements"
                  ? "Tap to play. Edit only when you need to."
                  : section.description}
              </p>
            </div>
            <div className="heading-actions">
              {page === "announcements" ? (
                <>
                  <button
                    className="button primary"
                    onClick={() => (trip ? setEditor(trip) : newTrip())}
                    disabled={playing || Boolean(generation)}
                  >
                    <Edit3 size={16} />
                    {trip ? "Trip setup" : "Create trip"}
                  </button>
                </>
              ) : page === "trips" ? (
                <button className="button primary" onClick={() => newTrip()}>
                  <Plus size={17} /> New trip
                </button>
              ) : null}
            </div>
          </div>
          {page === "announcements" ? (
            <>
              {trip ? (
                <section
                  className="trip-strip journey-bar"
                  aria-label="Current trip"
                >
                  {trip.sample ? (
                    <div className="sample-trip-warning">
                      <Clock3 size={14} />
                      <span>Sample timetable — confirm trip details</span>
                      <button onClick={() => setEditor(trip)}>
                        Confirm <ChevronRight size={13} />
                      </button>
                    </div>
                  ) : null}
                  <div className="journey-main">
                    <button
                      className="journey-route"
                      aria-label="Edit current trip"
                      onClick={() => setEditor(trip)}
                      disabled={playing || Boolean(generation)}
                    >
                      <span>
                        <strong>{trip.origin}</strong>
                        <ArrowRight size={19} />
                        <strong>{trip.destination}</strong>
                      </span>
                      <small>
                        {vehicle?.name || "Choose a bus"}
                        <span>·</span>Arrival {formatArrival(trip.arrival)}
                        {trip.distanceKm ? ` · ${trip.distanceKm} km` : ""}
                        {wakeActive ? " · Screen awake" : ""}
                      </small>
                    </button>
                    <button
                      className={`trip-status ${trip.status}`}
                      disabled={
                        playing ||
                        Boolean(generation) ||
                        trip.status === "completed"
                      }
                      onClick={statusTrip}
                    >
                      {trip.status === "active" ? (
                        "End trip"
                      ) : trip.status === "completed" ? (
                        "Completed"
                      ) : (
                        <>
                          <Play size={13} />
                          Start trip
                        </>
                      )}
                    </button>
                  </div>
                </section>
              ) : (
                <section className="surface">
                  <EmptyState
                    title="Prepare your first journey"
                    action={
                      <button
                        className="button primary"
                        onClick={() => newTrip()}
                      >
                        <Plus size={17} /> Create trip
                      </button>
                    }
                  >
                    Add the route, bus and arrival time to personalize your
                    announcements.
                  </EmptyState>
                </section>
              )}
              <div className="workbench">
                <section
                  className="announcement-workspace"
                  aria-label="Quick announcements"
                >
                  <div className="quick-toolbar">
                    <div
                      className="segmented list-filter"
                      role="group"
                      aria-label="Announcement filter"
                    >
                      <button
                        aria-pressed={onlyFavorites}
                        onClick={() => setOnlyFavorites(true)}
                      >
                        Favourites
                      </button>
                      <button
                        aria-pressed={!onlyFavorites}
                        onClick={() => {
                          setOnlyFavorites(false);
                          setCategory("All announcements");
                        }}
                      >
                        All <span>{w.templates.length}</span>
                      </button>
                    </div>
                    <div className="quick-tools">
                      <button
                        className="icon-button"
                        aria-label="Search announcements"
                        aria-expanded={showSearch}
                        onClick={() => setShowSearch(!showSearch)}
                      >
                        <Search size={19} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Create custom announcement"
                        onClick={() => setCustom(true)}
                      >
                        <Plus size={21} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="sequence-shortcut"
                    disabled={playing || Boolean(generation)}
                    onClick={() => setSequenceDialog(true)}
                    aria-label="Change playback sequence"
                  >
                    <Repeat2 size={17} />
                    <strong>{playbackSequenceLabel(sequence, true)}</strong>
                    <span>Every announcement</span>
                    <SlidersHorizontal size={15} />
                  </button>
                  {showSearch ? (
                    <div className="search-field quick-search">
                      <Search size={17} />
                      <input
                        autoFocus
                        aria-label="Search announcements"
                        placeholder="Search all announcements"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setOnlyFavorites(false);
                        }}
                      />
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => {
                          setQuery("");
                          setShowSearch(false);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                  <QuickAnnouncements
                    templates={filtered}
                    onPlay={quickPlay}
                    onEdit={selectAnnouncement}
                    playingId={playingTemplateId}
                    disabled={playing || Boolean(generation) || !trip}
                    gestures={prefs!.gestures}
                    readiness={quickReadiness}
                  />
                  {!filtered.length ? (
                    <EmptyState icon={Search} title="No announcements found">
                      {onlyFavorites
                        ? "Open All and use Edit to add an announcement to your favourites."
                        : "Try a different search."}
                    </EmptyState>
                  ) : null}
                  <div className="quick-list-footer">
                    <span>
                      {prefs!.gestures
                        ? "Tap to play · Hold to edit"
                        : "Tap to play · Use Edit for changes"}
                      {prefs!.quietMode ? (
                        <Moon size={12} aria-label="Quiet journey enabled" />
                      ) : null}
                    </span>
                    <button
                      onClick={() => setPreparePack(true)}
                      disabled={!trip || playing || Boolean(generation)}
                    >
                      <Download size={15} /> Prepare audio
                    </button>
                  </div>
                </section>
                {showPreview ? (
                  <button
                    className="editor-scrim"
                    aria-label="Close announcement editor"
                    onClick={() => setShowPreview(false)}
                  />
                ) : null}
                <aside
                  ref={previewPanel}
                  role={showPreview ? "dialog" : undefined}
                  aria-modal={showPreview ? true : undefined}
                  hidden={!showPreview}
                  className={`preview-panel surface ${showPreview ? "mobile-visible" : ""}`}
                  aria-label="Announcement preview"
                >
                  {selected && trip ? (
                    <>
                      <div
                        className="preview-top"
                        onPointerDown={(event) => {
                          if (
                            prefs!.gestures &&
                            !(event.target as HTMLElement).closest("button")
                          )
                            sheetSwipe.current = {
                              x: event.clientX,
                              y: event.clientY,
                            };
                        }}
                        onPointerUp={(event) => {
                          const start = sheetSwipe.current;
                          sheetSwipe.current = null;
                          if (
                            start &&
                            event.clientY - start.y > 60 &&
                            Math.abs(event.clientX - start.x) < 45
                          )
                            setShowPreview(false);
                        }}
                        onPointerCancel={() => {
                          sheetSwipe.current = null;
                        }}
                      >
                        <span>Edit announcement</span>
                        <button
                          className="icon-button mobile-preview-close"
                          onClick={() => setShowPreview(false)}
                          aria-label="Close preview"
                        >
                          <X size={20} />
                        </button>
                        <button
                          className="icon-button edit-favourite"
                          aria-label={
                            prefs!.favoriteIds.includes(selected.id)
                              ? "Remove from favourites"
                              : "Add to favourites"
                          }
                          aria-pressed={prefs!.favoriteIds.includes(
                            selected.id,
                          )}
                          onClick={() =>
                            preferences({
                              ...prefs!,
                              favoriteIds: prefs!.favoriteIds.includes(
                                selected.id,
                              )
                                ? prefs!.favoriteIds.filter(
                                    (id) => id !== selected.id,
                                  )
                                : [...prefs!.favoriteIds, selected.id],
                            })
                          }
                        >
                          <Star
                            size={18}
                            fill={
                              prefs!.favoriteIds.includes(selected.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </div>
                      <div className="preview-intro">
                        <span className="preview-symbol">
                          <AnnouncementIcon name={selected.icon} size={28} />
                        </span>
                        <h2>{selected.title}</h2>
                        <p>{selected.description}</p>
                      </div>
                      <div className="preview-controls">
                        <label className="language-select">
                          <Volume2 size={16} />
                          <select
                            aria-label="Playback languages"
                            value={languageMode}
                            disabled={playing}
                            onChange={(e) =>
                              preferences({
                                ...prefs!,
                                languageMode: e.target
                                  .value as Preferences["languageMode"],
                              })
                            }
                          >
                            {Object.entries(languageLabels).map(
                              ([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                        <span className="duration">
                          ~
                          {sequence.reduce(
                            (sum, l) => sum + estimatedSeconds(scripts[l]),
                            0,
                          )}{" "}
                          sec
                        </span>
                      </div>
                      {factsNeeded ? (
                        <div className="context-fields">
                          {["break", "approaching", "arrival"].includes(
                            selected.id,
                          ) ? (
                            <label>
                              {selected.id === "break"
                                ? "Stop location"
                                : "Drop-off point"}
                              <input
                                disabled={playing}
                                maxLength={100}
                                value={effectiveFacts.stopName}
                                onChange={(e) =>
                                  setFacts({
                                    ...facts,
                                    stopName: e.target.value,
                                  })
                                }
                                list="trip-stop-names"
                              />
                              <datalist id="trip-stop-names">
                                {trip.stops.map((s) => (
                                  <option key={s.id} value={s.name} />
                                ))}
                              </datalist>
                            </label>
                          ) : null}
                          {selected.id === "break" ? (
                            <label>
                              Break duration
                              <select
                                disabled={playing}
                                value={effectiveFacts.breakMinutes}
                                onChange={(e) =>
                                  setFacts({
                                    ...facts,
                                    breakMinutes: Number(e.target.value),
                                  })
                                }
                              >
                                {[0, 5, 10, 15, 20, 30, 45, 60].map((n) => (
                                  <option value={n} key={n}>
                                    {n === 0
                                      ? "Crew will confirm"
                                      : `${n} minutes`}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {["congestion", "unscheduled"].includes(
                            selected.id,
                          ) ? (
                            <>
                              <label>
                                Confirmed reason
                                <select
                                  disabled={playing}
                                  value={facts.reason}
                                  onChange={(e) =>
                                    setFacts({
                                      ...facts,
                                      reason: e.target
                                        .value as AnnouncementFacts["reason"],
                                    })
                                  }
                                >
                                  <option value="unspecified">
                                    Reason not confirmed
                                  </option>
                                  <option value="traffic">
                                    Traffic congestion
                                  </option>
                                  <option value="roadblock">
                                    Road obstruction
                                  </option>
                                  <option value="operational">
                                    Operational issue
                                  </option>
                                </select>
                              </label>
                              {selected.id === "congestion" ? (
                                <div className="form-grid">
                                  <label>
                                    Delay (minutes)
                                    <input
                                      disabled={playing}
                                      type="number"
                                      min={0}
                                      max={1440}
                                      value={facts.delayMinutes}
                                      onChange={(e) =>
                                        setFacts({
                                          ...facts,
                                          delayMinutes: Math.min(
                                            1440,
                                            Math.max(0, Number(e.target.value)),
                                          ),
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    Updated arrival
                                    <input
                                      disabled={playing}
                                      type="datetime-local"
                                      onChange={(e) =>
                                        setFacts({
                                          ...facts,
                                          revisedArrival: e.target.value
                                            ? new Date(
                                                e.target.value,
                                              ).toISOString()
                                            : "",
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          {selected.id === "summary" ? (
                            <div className="forecast-row">
                              <span>
                                {facts.weather?.destination ===
                                trip.destination ? (
                                  <>
                                    <Sun size={16} />
                                    {Math.round(facts.weather.temperature)}°C ·{" "}
                                    {facts.weather.condition}
                                    <small>
                                      Forecast near arrival · MET Norway
                                    </small>
                                  </>
                                ) : (
                                  <>
                                    <Sun size={17} /> Arrival weather optional
                                  </>
                                )}
                              </span>
                              <button
                                className="text-button"
                                disabled={weatherBusy || !online || playing}
                                onClick={weather}
                              >
                                {weatherBusy ? (
                                  <LoaderCircle size={16} className="spin" />
                                ) : (
                                  <RefreshCw size={15} />
                                )}
                                {facts.weather?.destination === trip.destination
                                  ? "Refresh"
                                  : "Fetch"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="script-section">
                        <div className="script-heading">
                          <div
                            className="script-tabs"
                            aria-label="Script preview language"
                          >
                            {(["en", "ml"] as const).map((l) => (
                              <button
                                key={l}
                                className={
                                  previewLanguage === l ? "active" : ""
                                }
                                aria-pressed={previewLanguage === l}
                                onClick={() => setPreviewLanguage(l)}
                              >
                                {l === "en" ? "English" : "മലയാളം"}
                              </button>
                            ))}
                          </div>
                          <button
                            className="icon-button"
                            aria-label={
                              editingScript
                                ? "Finish editing script"
                                : "Edit announcement script"
                            }
                            disabled={playing}
                            onClick={() => setEditingScript(!editingScript)}
                          >
                            {editingScript ? (
                              <Check size={16} />
                            ) : (
                              <Edit3 size={15} />
                            )}
                          </button>
                        </div>
                        {editingScript ? (
                          <textarea
                            className="script-editor"
                            maxLength={1800}
                            aria-label="Announcement script"
                            lang={previewLanguage}
                            value={scripts[previewLanguage]}
                            onChange={(e) =>
                              setOverrides({
                                key: scriptKey,
                                en: scripts.en,
                                ml: scripts.ml,
                                [previewLanguage]: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <p className="script-copy" lang={previewLanguage}>
                            {scripts[previewLanguage]}
                          </p>
                        )}
                        {overrides?.key === scriptKey ? (
                          <div className="script-edited">
                            <span>Edited for this playback</span>
                            <button
                              className="text-button"
                              onClick={() => setOverrides(null)}
                            >
                              Reset
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="playback-section">
                        <div className="audio-readiness">
                          <span className={allReady ? "good" : ""}>
                            {allReady ? (
                              <CheckCheck size={15} />
                            ) : (
                              <Smartphone size={15} />
                            )}
                            {allReady
                              ? "Saved on this phone"
                              : prefs!.speechProvider === "gemini"
                                ? "Prepare audio before playing"
                                : readiness.canPlay
                                  ? "Device voices ready"
                                  : `${missingNames} ${readiness.missing.length > 1 ? "voices" : "voice"} missing`}
                          </span>
                          <span>
                            {allReady
                              ? "Offline ready"
                              : readiness.canPlay
                                ? "Test before boarding"
                                : "Audio needed"}
                          </span>
                        </div>
                        {!readiness.canPlay && !playing ? (
                          <p className="playback-recovery">
                            {prefs!.speechProvider === "gemini"
                              ? `Prepare or record the missing ${missingNames} audio below.`
                              : `Add a recording or prepare ${missingNames} audio below. You can also change the playback languages.`}
                          </p>
                        ) : null}
                        <button
                          className={`play-button ${playing ? "is-playing" : ""}`}
                          disabled={
                            Boolean(generation) ||
                            (!playing && !readiness.canPlay) ||
                            (!playing &&
                              !scripts.en.trim() &&
                              !scripts.ml.trim())
                          }
                          onClick={playing ? stopPlayback : requestPlay}
                        >
                          {playing ? (
                            <Square size={19} fill="currentColor" />
                          ) : (
                            <Play size={19} fill="currentColor" />
                          )}
                          <span>
                            {playing
                              ? "Stop announcement"
                              : "Play announcement"}
                          </span>
                          {playing ? (
                            <AudioLines size={20} className="audio-pulse" />
                          ) : (
                            <span className="play-shortcut">
                              <Volume2 size={16} />
                            </span>
                          )}
                        </button>
                        {playing ? (
                          <p className="playing-label" role="status">
                            Playing{" "}
                            {playingLanguage === "ml" ? "Malayalam" : "English"}{" "}
                            through your phone’s selected audio output
                          </p>
                        ) : (
                          <p className="play-help">
                            Plays through your phone’s selected audio output.
                          </p>
                        )}
                        <div className="voice-actions">
                          <button
                            disabled={playing || Boolean(generation) || !online}
                            onClick={() => generate([selected])}
                          >
                            {generation ? (
                              <LoaderCircle className="spin" size={15} />
                            ) : (
                              <Sparkles size={15} />
                            )}
                            {generation ? "Preparing…" : "Prepare voice"}
                          </button>
                          <button
                            disabled={playing || Boolean(generation)}
                            onClick={() => setRecord(true)}
                          >
                            <Mic2 size={15} /> Add recording
                          </button>
                        </div>
                        {generation ? (
                          <div className="generation-status">
                            <span>{generation}</span>
                            <button
                              className="text-button"
                              onClick={() => abort.current?.abort()}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="preview-footer">
                        <Bluetooth size={15} />
                        <span>
                          Paired with the bus?{" "}
                          <button onClick={() => setAudioTest(true)}>
                            Test your speakers
                          </button>
                        </span>
                      </div>
                    </>
                  ) : (
                    <EmptyState title="Your announcement preview">
                      Create a trip, then choose a moment to hear how it sounds.
                    </EmptyState>
                  )}
                </aside>
              </div>
            </>
          ) : null}
          {page === "trips" ? (
            <div className="trips-layout">
              <section className="surface">
                <div className="panel-heading">
                  <div>
                    <h2>Upcoming & recent journeys</h2>
                    <p>Scheduled times are entered by your crew.</p>
                  </div>
                  <label className="button secondary file-button">
                    <ArrowDownToLine size={16} /> Import trip
                    <input
                      ref={importInput}
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        if (e.target.files?.[0]) importTrip(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {w.trips.length ? (
                  <div className="trip-list">
                    {[...w.trips]
                      .sort((a, b) => b.departure.localeCompare(a.departure))
                      .map((t) => (
                        <article
                          className={`trip-list-item ${trip?.id === t.id ? "current" : ""}`}
                          key={t.id}
                        >
                          <div className="trip-date">
                            <strong>
                              {new Intl.DateTimeFormat("en-IN", {
                                day: "2-digit",
                                timeZone: "Asia/Kolkata",
                              }).format(new Date(t.departure))}
                            </strong>
                            <span>
                              {new Intl.DateTimeFormat("en-IN", {
                                month: "short",
                                timeZone: "Asia/Kolkata",
                              }).format(new Date(t.departure))}
                            </span>
                          </div>
                          <div className="trip-list-info">
                            <h3>
                              {t.origin}
                              <ArrowRight size={17} />
                              {t.destination}
                            </h3>
                            <p>
                              {w.vehicles.find((v) => v.id === t.vehicleId)
                                ?.name || "Bus not assigned"}{" "}
                              · {formatArrival(t.departure)} departure
                            </p>
                            <span
                              className={`status-label ${t.status === "active" ? "good" : ""}`}
                            >
                              {t.sample ? "Illustrative timetable" : t.status}
                            </span>
                          </div>
                          <div className="trip-list-actions">
                            <button
                              className="button secondary small"
                              disabled={playing || Boolean(generation)}
                              onClick={() => setEditor(t)}
                            >
                              <Edit3 size={15} /> Edit
                            </button>
                            <button
                              className={`button ${trip?.id === t.id ? "selected-button" : "primary"} small`}
                              disabled={playing || Boolean(generation)}
                              onClick={() => {
                                changeTrip(t.id);
                                setPage("announcements");
                              }}
                            >
                              {trip?.id === t.id ? <Check size={15} /> : null}
                              {trip?.id === t.id ? "Selected" : "Use trip"}
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                ) : (
                  <EmptyState title="Your first trip starts here">
                    Create a journey and confirm the actual timetable before
                    departure.
                  </EmptyState>
                )}
              </section>
              {trip ? (
                <section className="surface settings-section itinerary">
                  <div className="section-heading">
                    <h2>Trip itinerary</h2>
                    <Route size={20} />
                  </div>
                  <div className="itinerary-route">
                    <strong>{trip.origin}</strong>
                    <span>Departure · {formatArrival(trip.departure)}</span>
                    {trip.stops.map((stop) => (
                      <div key={stop.id}>
                        <span className="route-dot" />
                        <strong>{stop.name}</strong>
                        <small>
                          {stop.type} · {stop.minutes} min
                        </small>
                      </div>
                    ))}
                    <strong>{trip.destination}</strong>
                    <span>
                      Scheduled arrival · {formatArrival(trip.arrival)}
                    </span>
                  </div>
                  <p className="field-help">
                    {trip.distanceKm
                      ? `${trip.distanceKm} km · entered by crew`
                      : "Distance not set · omitted from briefing"}
                  </p>
                  <div className="form-stack">
                    <button
                      className="button secondary"
                      onClick={() => newTrip(true)}
                    >
                      <Route size={16} /> Create return journey
                    </button>
                    <DownloadLink
                      data={{ version: 1, trip }}
                      name="nightline-trip.json"
                      label={
                        <>
                          <Download size={16} /> Export this trip
                        </>
                      }
                    />
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
          {page === "library" ? (
            <AudioLibrary
              fleetId={w.fleet.id}
              revision={audioVersion}
              notify={notify}
            />
          ) : null}
          {page === "history" ? (
            <section className="surface">
              <div className="panel-heading">
                <div>
                  <h2>Announcement activity</h2>
                  <p>
                    Device playback records. Always verify sound in the cabin.
                  </p>
                </div>
                <DownloadLink
                  data={{ version: 1, fleet: w.fleet.name, events: w.events }}
                  name="nightline-activity.json"
                  label={
                    <>
                      <Download size={16} /> Export
                    </>
                  }
                />
              </div>
              {!w.events.length ? (
                <EmptyState icon={History} title="A fresh start">
                  Your announcement history will appear here after playback.
                  Failed and stopped attempts are recorded too.
                </EmptyState>
              ) : (
                <div className="history-list">
                  {w.events.map((event) => (
                    <div className="history-row" key={event.id}>
                      <span className={`history-symbol ${event.status}`}>
                        {event.status === "played" ? (
                          <CheckCheck size={19} />
                        ) : event.status === "stopped" ? (
                          <Square size={17} />
                        ) : (
                          <Volume2 size={18} />
                        )}
                      </span>
                      <div>
                        <strong>{event.title}</strong>
                        <span>
                          {event.sequence
                            ? playbackSequenceLabel(event.sequence, true)
                            : languageLabels[event.languageMode]}{" "}
                          ·{" "}
                          {event.source === "device"
                            ? "Device voice"
                            : "Saved audio"}
                        </span>
                        {event.detail ? <p>{event.detail}</p> : null}
                      </div>
                      <div className="history-time">
                        <span
                          className={`status-label ${event.status === "played" ? "good" : event.status === "failed" ? "bad" : ""}`}
                        >
                          {event.status}
                        </span>
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
          {page === "fleet" ? (
            <FleetPanel
              workspace={w}
              identity={identity}
              update={update}
              notify={notify}
              onAccount={openAccount}
            />
          ) : null}
          {page === "settings" ? (
            <SettingsPanel
              preferences={prefs!}
              update={preferences}
              config={config}
              voices={voices}
              onAccount={openAccount}
              onTest={() => setAudioTest(true)}
              onInstall={install}
              installable={Boolean(installPrompt)}
              installed={installed}
              notify={notify}
            />
          ) : null}
          <footer className="workspace-footer">
            <button onClick={() => setHelp(true)}>
              <CircleHelp size={15} /> Help
            </button>
            <span>{identity ? w.fleet.name : "Saved on this device"}</span>
            <button onClick={() => setAudioTest(true)}>
              <Bluetooth size={15} /> Speaker test
            </button>
          </footer>
        </main>
      </div>
      <nav className="mobile-dock" aria-label="Quick navigation">
        {sections.slice(0, 3).map(({ id, icon: Icon }) => (
          <button
            key={id}
            aria-current={page === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>
              {id === "announcements"
                ? "Announce"
                : id === "trips"
                  ? "Trips"
                  : "Audio"}
            </span>
          </button>
        ))}
        <button onClick={() => setMenu(true)} aria-label="More tools">
          <Menu size={20} />
          <span>More</span>
        </button>
      </nav>
      {playing ? (
        <div
          className="global-player"
          role="status"
          onPointerDown={(event) => {
            if (
              prefs!.gestures &&
              !(event.target as HTMLElement).closest("button")
            )
              playerSwipe.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = playerSwipe.current;
            playerSwipe.current = null;
            if (
              start &&
              start.x - event.clientX > 65 &&
              Math.abs(start.y - event.clientY) < 40
            )
              stopPlayback();
          }}
          onPointerCancel={() => {
            playerSwipe.current = null;
          }}
        >
          <span className="player-wave">
            <AudioLines size={23} />
          </span>
          <div>
            <strong>{playingTitle}</strong>
            <span>
              {playingLanguage === "en" ? "English" : "Malayalam"} ·{" "}
              {playingStep.index + 1} of {playingStep.total}
              {prefs!.gestures ? " · Swipe left to stop" : ""}
            </span>
            <div className="sequence-progress" aria-hidden="true">
              {Array.from({ length: playingStep.total }, (_, index) => (
                <span
                  key={index}
                  className={index <= playingStep.index ? "complete" : ""}
                />
              ))}
            </div>
          </div>
          <button
            className="button danger"
            onClick={stopPlayback}
            aria-label="Stop playback sequence"
          >
            <Square size={17} fill="currentColor" /> Stop
          </button>
        </div>
      ) : null}
      {menu ? (
        <Dialog title="All tools" onClose={() => setMenu(false)}>
          <nav className="tools-navigation" aria-label="More navigation">
            {sections.map(({ id, title, icon: Icon }) => (
              <button key={id} onClick={() => navigate(id)}>
                <Icon size={20} />
                <span>{title}</span>
                <ChevronRight size={17} />
              </button>
            ))}
            <button
              onClick={() => {
                setMenu(false);
                openAccount();
              }}
            >
              <Cloud size={20} />
              <span>{identity ? "Fleet account" : "Connect account"}</span>
              <ChevronRight size={17} />
            </button>
          </nav>
        </Dialog>
      ) : null}
      {sequenceDialog ? (
        <SequenceDialog
          preferences={prefs!}
          onSave={preferences}
          onClose={() => setSequenceDialog(false)}
        />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          <Bell size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      {editor ? (
        <TripEditor
          trip={editor}
          vehicles={w.vehicles}
          drivers={
            isAdmin ? w.drivers : w.drivers.filter((d) => d.id === identity?.id)
          }
          onSave={saveTrip}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {account ? (
        identity ? (
          <Dialog title="Your fleet account" onClose={() => setAccount(false)}>
            <div className="form-stack">
              <div className="account-summary">
                <span className="avatar">{identity.name.slice(0, 1)}</span>
                <div>
                  <h3>{identity.name}</h3>
                  <p>{identity.email}</p>
                  <span className="status-label">
                    {identity.role === "admin"
                      ? "Fleet administrator"
                      : "Driver"}
                  </span>
                </div>
              </div>
              <p className="muted">
                {w.pending.length} changes waiting to synchronize. Signing out
                keeps the fleet’s downloaded data on this phone; use trusted
                devices.
              </p>
              <button
                className="button secondary"
                disabled={!online || syncing}
                onClick={() => sync().catch((err) => notify(errorMessage(err)))}
              >
                <RefreshCw size={17} /> Synchronize fleet
              </button>
              <button
                className="button danger"
                disabled={playing || Boolean(generation)}
                onClick={async () => {
                  await disconnect();
                  setAccount(false);
                  notify("Signed out. You are back in local pilot mode.");
                }}
              >
                <LogOut size={17} /> Sign out
              </button>
            </div>
          </Dialog>
        ) : (
          <AccountDialog
            onClose={() => setAccount(false)}
            onConnected={connectCloud}
          />
        )
      ) : null}
      {record && selected ? (
        <RecordDialog
          title={selected.title}
          texts={scripts}
          fleetId={w.fleet.id}
          onClose={() => setRecord(false)}
          onSaved={() => {
            setRecord(false);
            setAudioVersion((v) => v + 1);
            notify(
              "Recording saved on this phone. Add the other language if needed.",
            );
          }}
        />
      ) : null}
      {preparePack ? (
        <Dialog
          title="Prepare for an offline journey"
          onClose={() => {
            if (!generation) setPreparePack(false);
          }}
        >
          <div className="form-stack">
            <p className="muted">
              Save the voices for <strong>{tripTitle}</strong> using the current
              trip details. Internet and a configured Gemini key are needed only
              for preparation.
            </p>
            <label>
              Which announcements?
              <select
                disabled={Boolean(generation)}
                value={packAll ? "all" : "favorites"}
                onChange={(e) => setPackAll(e.target.value === "all")}
              >
                <option value="favorites">
                  Your favourites (
                  {
                    w.templates.filter((t) => prefs!.favoriteIds.includes(t.id))
                      .length
                  }
                  )
                </option>
                <option value="all">
                  All announcements ({w.templates.length})
                </option>
              </select>
            </label>
            <div className="notice">
              <Download size={18} />
              <span>
                Up to{" "}
                {(packAll
                  ? w.templates.length
                  : w.templates.filter((t) => prefs!.favoriteIds.includes(t.id))
                      .length) * requestedLanguages.length}{" "}
                voice requests. Existing matching files are reused.
              </span>
            </div>
            <p className="field-help">
              Stop and delay announcements use the current preview details.
              Changing those details requires new audio. Free-tier quotas apply;
              preparation stops if the service is unavailable.
            </p>
            {!config.gemini ? (
              <p className="inline-error">
                Gemini isn’t connected. You can still add recordings from each
                announcement preview.
              </p>
            ) : null}
            {generation ? (
              <div className="generation-status">
                <LoaderCircle size={17} className="spin" />
                <span>{generation}</span>
                <button
                  className="text-button"
                  onClick={() => abort.current?.abort()}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <button
              className="button primary"
              disabled={
                !config.gemini ||
                !online ||
                Boolean(generation) ||
                (!packAll && !prefs!.favoriteIds.length)
              }
              onClick={() =>
                generate(
                  packAll
                    ? w.templates
                    : w.templates.filter((t) =>
                        prefs!.favoriteIds.includes(t.id),
                      ),
                )
              }
            >
              <Download size={17} />
              {generation ? "Preparing voices…" : "Prepare & save audio"}
            </button>
            <button
              className="text-button"
              disabled={Boolean(generation)}
              onClick={async () => {
                const result = await navigator.storage?.persist?.();
                notify(
                  result
                    ? "Persistent storage enabled. Recheck audio before each departure."
                    : "This browser manages storage automatically. Avoid clearing site data and recheck before departure.",
                );
              }}
            >
              Protect downloaded audio from automatic cleanup
            </button>
          </div>
        </Dialog>
      ) : null}
      {audioTest ? (
        <Dialog
          title="Check your bus speakers"
          onClose={() => setAudioTest(false)}
        >
          <div className="form-stack">
            <div className="connection-illustration">
              <Bluetooth size={34} />
            </div>
            <p>
              Pair your phone in Bluetooth settings, select Bluetooth on the bus
              audio system, then play a short test tone.
            </p>
            <button
              className="button primary"
              onClick={() => {
                const context = new AudioContext();
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = "sine";
                oscillator.frequency.value = 523.25;
                gain.gain.setValueAtTime(0, context.currentTime);
                gain.gain.linearRampToValueAtTime(
                  0.12,
                  context.currentTime + 0.05,
                );
                gain.gain.linearRampToValueAtTime(
                  0,
                  context.currentTime + 0.65,
                );
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start();
                oscillator.stop(context.currentTime + 0.7);
                oscillator.onended = () => context.close();
              }}
            >
              <Volume2 size={18} /> Play test tone
            </button>
            <p className="field-help">
              Start with a low media volume. The app cannot detect which
              speakers you hear.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setLastSaved(
                  new Date().toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                );
                setAudioTest(false);
                notify(
                  "Speaker check confirmed by you. Recheck after reconnecting Bluetooth.",
                );
              }}
            >
              <CheckCheck size={17} /> I heard it through the bus speakers
            </button>
            {lastSaved ? (
              <p className="field-help">
                Last confirmed by crew at {lastSaved} this session.
              </p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
      {custom ? (
        <CustomAnnouncement
          onClose={() => setCustom(false)}
          onSave={(template) => {
            update(
              (s) => ({ ...s, templates: [...s.templates, template] }),
              isAdmin
                ? { kind: "template", id: template.id, payload: template }
                : undefined,
            );
            setSelectedId(template.id);
            setCategory("All announcements");
            setQuery("");
            setOnlyFavorites(false);
            setCustom(false);
            setShowPreview(true);
            notify(
              isAdmin
                ? "Custom announcement saved. Add a recording or prepare its voice."
                : "Personal announcement saved on this phone.",
            );
          }}
        />
      ) : null}
      {installHelp ? (
        <Dialog title="Install Nightline" onClose={() => setInstallHelp(false)}>
          <div className="form-stack">
            <p>
              <strong>iPhone / iPad:</strong> Open this page in Safari, tap
              Share, then Add to Home Screen.
            </p>
            <p>
              <strong>Android:</strong> Open in Chrome, then choose Install app
              or Add to Home screen from the menu.
            </p>
            <p className="field-help">
              Offline app installation is available in production builds over
              HTTPS. Open the app online once and save your audio before
              departure.
            </p>
            <button
              className="button primary"
              onClick={() => setInstallHelp(false)}
            >
              Got it
            </button>
          </div>
        </Dialog>
      ) : null}
      {help ? (
        <Dialog
          title="A good journey starts here"
          onClose={() => setHelp(false)}
        >
          <div className="form-stack">
            <ol className="steps help-steps">
              <li>
                <strong>Set up the trip.</strong> Confirm the route, timetable,
                bus and crew. Sample times aren’t a real schedule.
              </li>
              <li>
                <strong>Connect your audio.</strong> Pair your phone with the
                bus and play the speaker test.
              </li>
              <li>
                <strong>Prepare the voices.</strong> Use available device
                voices, upload a recording, or generate and save Gemini audio.
              </li>
              <li>
                <strong>Choose a moment.</strong> Tap the announcement to play
                your saved sequence. Use Edit or hold the announcement to review
                the bilingual script. Stops, traffic and delays are entered by
                the crew.
              </li>
              <li>
                <strong>Keep your passengers informed.</strong> Use Stop at any
                time. Interact while parked or ask an attendant to operate the
                app.
              </li>
            </ol>
            <p className="field-help">
              This pilot does not monitor GPS or traffic automatically. A PWA
              cannot guarantee playback after locking the phone or switching
              apps. Your existing microphone remains available.
            </p>
            <button
              className="button primary"
              onClick={() => {
                setHelp(false);
                setPage("settings");
              }}
            >
              Check playback settings <ArrowRight size={17} />
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
function CustomAnnouncement({
  onSave,
  onClose,
}: {
  onSave: (template: AnnouncementTemplate) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [en, setEn] = useState("");
  const [ml, setMl] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: uid(),
      title: title.trim(),
      en: en.trim(),
      ml: ml.trim(),
      category: "Journey",
      description: "Your crew’s own announcement.",
      icon: "mic",
      custom: true,
    });
  }
  return (
    <Dialog title="Your words, your announcement" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <label>
          Announcement title
          <input
            required
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="For example, a change of drop-off point"
          />
        </label>
        <label>
          English script
          <textarea
            required
            maxLength={1800}
            rows={4}
            value={en}
            onChange={(e) => setEn(e.target.value)}
          />
        </label>
        <label>
          Malayalam script
          <textarea
            required
            lang="ml"
            maxLength={1800}
            rows={4}
            value={ml}
            onChange={(e) => setMl(e.target.value)}
          />
        </label>
        <p className="field-help">
          Review both scripts with a Malayalam speaker before using them with
          passengers.
        </p>
        <div className="dialog-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!title.trim() || !en.trim() || !ml.trim()}
          >
            <Save size={16} /> Save announcement
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function templateFacts(
  template: AnnouncementTemplate,
  trip: Trip,
  facts: AnnouncementFacts,
): AnnouncementFacts {
  return {
    ...facts,
    breakMinutes:
      facts.breakMinutes ??
      trip.stops.find((s) => s.type === "break")?.minutes ??
      0,
    stopName:
      facts.stopName ||
      trip.stops.find(
        (s) =>
          s.type === (template.category === "Arrival" ? "drop-off" : "break"),
      )?.name ||
      (template.category === "Arrival" ? trip.destination : ""),
  };
}
