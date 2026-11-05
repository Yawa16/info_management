"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadUserRights, saveUserRights } from "@/lib/actions/rights";
import type { RightsDialogData } from "@/lib/actions/rights-types";
import "./RightsDialog.css";

export default function RightsDialog({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<RightsDialogData | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function open() {
    setError("");
    setData(null);
    dialogRef.current?.showModal();
    startTransition(async () => {
      const result = await loadUserRights(userId);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      const granted = new Set(result.data.grantedRightIds);
      setData(result.data);
      setSelected(granted);
      setEnabled(
        new Set(
          result.data.modules
            .filter((module) => module.rights.some((right) => granted.has(right.id)))
            .map((module) => module.code),
        ),
      );
    });
  }

  function close() {
    dialogRef.current?.close();
  }

  function toggleModule(code: string, rightIds: number[], on: boolean) {
    setEnabled((current) => {
      const next = new Set(current);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
    if (!on) {
      setSelected((current) => {
        const next = new Set(current);
        rightIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  function setModuleRights(code: string, rightIds: number[], all: boolean) {
    if (all) {
      setEnabled((current) => new Set(current).add(code));
    }
    setSelected((current) => {
      const next = new Set(current);
      rightIds.forEach((id) => (all ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function toggleRight(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (!data) return;
    setError("");
    const enabledRightIds = data.modules
      .filter((module) => enabled.has(module.code))
      .flatMap((module) => module.rights.map((right) => right.id))
      .filter((id) => selected.has(id));

    startTransition(async () => {
      const result = await saveUserRights(userId, enabledRightIds);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button className="button button-small" onClick={open} type="button">
        Rights
      </button>
      <dialog
        aria-labelledby={`rights-title-${userId}`}
        className="rights-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        ref={dialogRef}
      >
        <div className="rights-dialog-body">
          <header className="rights-dialog-header">
            <div>
              <h2 id={`rights-title-${userId}`}>Rights</h2>
              <p>{userName}</p>
            </div>
            <button
              aria-label="Close"
              className="rights-dialog-close"
              onClick={close}
              type="button"
            >
              ×
            </button>
          </header>

          {!data && !error && <p className="rights-dialog-note">Loading rights…</p>}

          {data && (
            <div className="rights-dialog-modules">
              {data.modules.map((module) => {
                const ids = module.rights.map((right) => right.id);
                const isEnabled = enabled.has(module.code);
                const count = ids.filter((id) => selected.has(id)).length;

                return (
                  <fieldset className="rights-module" key={module.code}>
                    <legend className="sr-only">{module.name}</legend>
                    <div className="rights-module-head">
                      <label className="rights-module-toggle">
                        <input
                          checked={isEnabled}
                          onChange={(event) =>
                            toggleModule(module.code, ids, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>{module.name}</span>
                        <small>
                          {count}/{ids.length}
                        </small>
                      </label>
                      <div className="rights-module-bulk">
                        <button
                          className="button button-small"
                          onClick={() => setModuleRights(module.code, ids, true)}
                          type="button"
                        >
                          All
                        </button>
                        <button
                          className="button button-small"
                          disabled={!isEnabled}
                          onClick={() => setModuleRights(module.code, ids, false)}
                          type="button"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="rights-module-list">
                      {module.rights.map((right) => (
                        <label className="rights-item" key={right.id}>
                          <input
                            checked={selected.has(right.id)}
                            disabled={!isEnabled}
                            onChange={() => toggleRight(right.id)}
                            type="checkbox"
                          />
                          <span>{right.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}

          {error && (
            <p className="user-action-message" role="alert">
              {error}
            </p>
          )}

          <footer className="rights-dialog-footer">
            <button
              className="button button-small"
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button-small rights-save"
              disabled={isPending || !data}
              onClick={save}
              type="button"
            >
              {isPending && data ? "Saving…" : "Save Rights"}
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
