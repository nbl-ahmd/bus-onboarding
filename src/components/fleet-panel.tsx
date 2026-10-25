"use client";
import { useState, type FormEvent } from "react";
import {
  Bus,
  Plus,
  UserRound,
  Building2,
  Cloud,
  Save,
  ShieldCheck,
} from "lucide-react";
import { authHeaders, getSupabase } from "@/adapters/supabase";
import {
  uid,
  type Driver,
  type Mutation,
  type SessionIdentity,
  type Vehicle,
  type Workspace,
} from "@/domain/models";
import { Dialog, errorMessage } from "./ui";
export function FleetPanel({
  workspace: w,
  identity,
  update,
  notify,
  onAccount,
}: {
  workspace: Workspace;
  identity: SessionIdentity | null;
  update: (fn: (w: Workspace) => Workspace, mutation?: Mutation) => void;
  notify: (message: string) => void;
  onAccount: () => void;
}) {
  const [modal, setModal] = useState<"vehicle" | "driver" | null>(null);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [password, setPassword] = useState("");
  const [fleetName, setFleetName] = useState(w.fleet.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = !identity || identity.role === "admin";
  function open(type: "vehicle" | "driver") {
    setName("");
    setDetail("");
    setPassword("");
    setError("");
    setModal(type);
  }
  async function saveFleet(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (identity) {
        const result = await getSupabase()!
          .from("fleets")
          .update({ name: fleetName.trim() })
          .eq("id", w.fleet.id);
        if (result.error) throw result.error;
      }
      update((s) => ({ ...s, fleet: { ...s.fleet, name: fleetName.trim() } }));
      notify(
        "Fleet name saved. Re-prepare audio if the spoken fleet name has changed.",
      );
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal === "vehicle") {
        const vehicle: Vehicle = {
          id: uid(),
          fleetId: w.fleet.id,
          name: name.trim(),
          registration: detail.trim(),
        };
        update((s) => ({ ...s, vehicles: [...s.vehicles, vehicle] }), {
          kind: "vehicle",
          id: vehicle.id,
          payload: vehicle,
        });
      } else {
        let driver: Driver;
        if (identity) {
          const response = await fetch("/api/fleet/drivers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(await authHeaders()),
            },
            body: JSON.stringify({
              name: name.trim(),
              email: detail.trim(),
              password,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          driver = data;
        } else
          driver = {
            id: uid(),
            fleetId: w.fleet.id,
            name: name.trim(),
            email: detail.trim(),
            role: "driver",
          };
        update((s) => ({ ...s, drivers: [...s.drivers, driver] }));
      }
      setModal(null);
      notify(
        modal === "vehicle"
          ? "Bus added. Synchronize to share it with your fleet."
          : identity
            ? "Driver account created. Share the credentials with your driver securely."
            : "Local driver profile added. This is not a cloud login.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fleet-layout">
      <section className="surface settings-section">
        <div className="section-heading">
          <h2>Fleet details</h2>
          <Building2 size={21} />
        </div>
        <form onSubmit={saveFleet} className="form-stack">
          <label>
            Fleet name
            <input
              required
              maxLength={100}
              disabled={!admin}
              value={fleetName}
              onChange={(e) => setFleetName(e.target.value)}
            />
          </label>
          {admin ? (
            <button
              type="submit"
              className="button secondary align-start"
              disabled={busy || !fleetName.trim()}
            >
              <Save size={16} /> Save name
            </button>
          ) : null}
        </form>
        <div className="local-note">
          <Cloud size={19} />
          <p>
            {identity ? (
              <>
                Connected as{" "}
                <strong>
                  {identity.role === "admin" ? "fleet administrator" : "driver"}
                </strong>
                . Sync shares saved trips with your assigned fleet.
              </>
            ) : (
              <>
                You’re in <strong>local pilot mode</strong>. Fleet profiles are
                saved on this phone. Connect Supabase for real accounts and
                shared trips.
              </>
            )}
          </p>
        </div>
        <button className="text-button" onClick={onAccount}>
          {identity ? "Account details" : "Connect fleet account"}
        </button>
      </section>
      <section className="surface">
        <div className="panel-heading">
          <div>
            <h2>Your buses</h2>
            <p>
              {w.vehicles.length} {w.vehicles.length === 1 ? "bus" : "buses"} in
              this fleet
            </p>
          </div>
          {admin ? (
            <button
              className="button secondary"
              onClick={() => open("vehicle")}
            >
              <Plus size={17} /> Add bus
            </button>
          ) : null}
        </div>
        <div className="entity-list">
          {w.vehicles.map((v) => (
            <div className="entity-row" key={v.id}>
              <span className="entity-icon">
                <Bus size={23} />
              </span>
              <div>
                <strong>{v.name}</strong>
                <span>{v.registration || "Registration not added"}</span>
              </div>
              <span className="status-label">Sleeper service</span>
            </div>
          ))}
          {!w.vehicles.length ? (
            <p className="muted">Add your first bus to prepare a trip.</p>
          ) : null}
        </div>
      </section>
      <section className="surface">
        <div className="panel-heading">
          <div>
            <h2>People behind the journey</h2>
            <p>Driver profiles and fleet administrators</p>
          </div>
          {admin ? (
            <button className="button secondary" onClick={() => open("driver")}>
              <Plus size={17} /> Add driver
            </button>
          ) : null}
        </div>
        <div className="entity-list">
          {w.drivers.map((d) => (
            <div className="entity-row" key={d.id}>
              <span className="avatar">{d.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{d.name}</strong>
                <span>{d.email || "Local pilot profile"}</span>
              </div>
              <span className="status-label">
                {d.role === "admin" ? (
                  <>
                    <ShieldCheck size={13} /> Administrator
                  </>
                ) : (
                  <>
                    <UserRound size={13} /> Driver
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
      {modal ? (
        <Dialog
          title={modal === "vehicle" ? "Add a bus" : "Add a driver"}
          onClose={() => setModal(null)}
        >
          <form className="form-stack" onSubmit={submit}>
            <label>
              {modal === "vehicle" ? "Bus name" : "Driver name"}
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {modal === "vehicle" ? "Registration number" : "Email address"}
              <input
                type={modal === "driver" ? "email" : "text"}
                required={modal === "vehicle" || Boolean(identity)}
                maxLength={120}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </label>
            {modal === "driver" && identity ? (
              <label>
                Initial password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={100}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="field-help">
                  At least 12 characters. Share directly with the driver.
                </span>
              </label>
            ) : null}
            {modal === "driver" && !identity ? (
              <p className="field-help">
                This adds a local profile. Connect your fleet account to create
                a real driver login.
              </p>
            ) : null}
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialog-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || !name.trim()}
                type="submit"
              >
                {busy
                  ? "Saving…"
                  : modal === "vehicle"
                    ? "Add bus"
                    : "Add driver"}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
