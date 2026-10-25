"use client";
import { useState, type FormEvent } from "react";
import { LogIn, Building2, ArrowRight } from "lucide-react";
import { getSupabase } from "@/adapters/supabase";
import { Dialog, errorMessage } from "./ui";
export function AccountDialog({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "fleet">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [fleet, setFleet] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = Boolean(getSupabase());
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const db = getSupabase();
      if (!db) throw new Error("Supabase is not configured yet.");
      if (mode === "fleet") {
        const result = await db.rpc("create_pilot_fleet", {
          fleet_name: fleet,
          display_name: name,
        });
        if (result.error) throw result.error;
      } else if (mode === "signup") {
        const result = await db.auth.signUp({ email, password });
        if (result.error) throw result.error;
        if (!result.data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
          setMode("login");
          return;
        }
      } else {
        const result = await db.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
      try {
        await onConnected();
        onClose();
      } catch (err) {
        if (errorMessage(err) === "NO_FLEET") setMode("fleet");
        else throw err;
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        mode === "fleet"
          ? "Create your fleet"
          : mode === "signup"
            ? "Create an administrator account"
            : "Sign in to your fleet"
      }
      onClose={onClose}
    >
      {!configured ? (
        <div className="form-stack">
          <div className="connection-illustration">
            <Building2 size={32} />
          </div>
          <p>
            Local pilot mode is ready to use. To enable real accounts and shared
            fleet data, connect a Supabase project using the setup guide in the
            project README.
          </p>
          <p className="muted">
            The local pilot contains no cloud accounts. Your changes stay on
            this device.
          </p>
          <button className="button primary" onClick={onClose}>
            Continue local pilot <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <p className="muted">
            {mode === "fleet"
              ? "Your new account will administer this fleet. Drivers receive accounts from their fleet administrator."
              : "Use your fleet account to synchronize trips between devices."}
          </p>
          {mode === "fleet" ? (
            <>
              <label>
                Your name
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Fleet name
                <input
                  required
                  maxLength={100}
                  value={fleet}
                  onChange={(e) => setFleet(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 12 : 1}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </>
          )}
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? <p className="notice">{message}</p> : null}
          <button className="button primary" disabled={busy} type="submit">
            <LogIn size={17} />
            {busy
              ? "Connecting…"
              : mode === "fleet"
                ? "Create fleet"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
          </button>
          {mode !== "fleet" ? (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
            >
              {mode === "login"
                ? "New fleet? Create an administrator account"
                : "Already have an account? Sign in"}
            </button>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
