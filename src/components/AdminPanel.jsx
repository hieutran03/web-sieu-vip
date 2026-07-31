// Admin sign-in + document upload.
// Flow: password -> HMAC token -> /api/admin/upload-signature -> browser uploads straight to
// Cloudinary with that signature. The API secret never reaches the browser, and the file never
// passes through the serverless function (so the 4.5 MB body limit is irrelevant).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { adminSession, api, CATEGORIES, formatBytes, PROVINCE_BY_SLUG, REGIONS, uploadToCloudinary } from "../lib/documents.js";
import { categoryLabel } from "../shared/classify.js";
import { PROVINCES } from "../shared/provinceMeta.js";

export function AdminPanel({ dc, language, session, onSession, health, stats, onClose, onUploaded }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  const adminConfigured = health?.admin?.configured !== false;

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(password);
      adminSession.write(result);
      onSession(result);
      setPassword("");
    } catch (loginError) {
      setError(String(loginError.message ?? loginError));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    adminSession.clear();
    onSession(null);
  };

  const addFiles = useCallback(
    async (fileList) => {
      const files = [...fileList];
      const drafts = files.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        title: file.name.replace(/\.[A-Za-z0-9]+$/, ""),
        status: "classifying",
        progress: 0,
        classification: null,
        hints: {},
        error: null
      }));
      setItems((current) => [...current, ...drafts]);

      for (const draft of drafts) {
        try {
          const { classification } = await api.classify({ fileName: draft.file.name });
          setItems((current) =>
            current.map((item) =>
              item.id === draft.id
                ? {
                    ...item,
                    status: "ready",
                    classification,
                    hints: {
                      region: classification.region ?? "",
                      provinceSlug: classification.provinceSlug ?? "",
                      zoneName: classification.zoneName ?? "",
                      category: classification.category ?? "other"
                    }
                  }
                : item
            )
          );
        } catch (classifyError) {
          setItems((current) =>
            current.map((item) => (item.id === draft.id ? { ...item, status: "ready", error: String(classifyError.message ?? classifyError) } : item))
          );
        }
      }
    },
    []
  );

  const updateHint = (id, key, value) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const hints = { ...item.hints, [key]: value };
        if (key === "provinceSlug" && value) {
          hints.region = PROVINCE_BY_SLUG.get(value)?.region ?? hints.region;
        }
        return { ...item, hints };
      })
    );
  };

  const uploadAll = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);

    for (const item of items) {
      if (item.status === "done") continue;
      try {
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "signing", progress: 0 } : entry)));

        const signature = await api.uploadSignature(
          {
            fileName: item.file.name,
            sizeBytes: item.file.size,
            title: item.title,
            hints: {
              region: item.hints.region || undefined,
              provinceSlug: item.hints.provinceSlug || undefined,
              zoneName: item.hints.zoneName || undefined,
              category: item.hints.category || undefined
            }
          },
          session.token
        );

        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading" } : entry)));

        const result = await uploadToCloudinary({
          file: item.file,
          uploadUrl: signature.uploadUrl,
          fields: signature.fields,
          onProgress: (progress) =>
            setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, progress } : entry)))
        });

        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, status: "done", progress: 100, publicId: result.public_id, url: result.secure_url } : entry
          )
        );
      } catch (uploadError) {
        const message = String(uploadError.message ?? uploadError);
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "failed", error: message } : entry)));
        if (/đăng nhập|401/i.test(message)) {
          adminSession.clear();
          onSession(null);
        }
      }
    }

    setBusy(false);
    onUploaded?.();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const zoneSuggestions = stats.zones.slice(0, 400).map((zone) => zone.zoneName);

  return (
    <div className="docs-viewer" role="dialog" aria-modal="true" aria-label={dc.admin.title}>
      <div className="docs-viewer-backdrop" onClick={onClose} />
      <div className="docs-viewer-panel is-admin">
        <header>
          <div>
            <h2>{dc.admin.title}</h2>
            <p>{dc.admin.hint}</p>
          </div>
          <div className="docs-viewer-actions">
            {session ? (
              <button type="button" onClick={signOut}>
                {dc.admin.logout}
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        <div className="docs-viewer-body is-admin">
          {!adminConfigured ? <p className="docs-admin-warning">{dc.admin.notConfigured}</p> : null}

          {!session ? (
            <form className="docs-admin-login" onSubmit={signIn}>
              <label>
                {dc.admin.password}
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              </label>
              <button type="submit" disabled={busy || !adminConfigured}>
                {dc.admin.submit}
              </button>
              {error ? <p className="docs-admin-error">{error}</p> : null}
            </form>
          ) : (
            <div className="docs-admin-upload">
              <button
                type="button"
                className="docs-dropzone"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
                }}
              >
                {dc.admin.dropzone}
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  if (event.target.files?.length) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />

              {items.length ? (
                <>
                  <ul className="docs-upload-list">
                    {items.map((item) => (
                      <li key={item.id} className={`docs-upload-item status-${item.status}`}>
                        <div className="docs-upload-head">
                          <strong>{item.file.name}</strong>
                          <span>{formatBytes(item.file.size)}</span>
                          <span className="docs-upload-status">
                            {item.status === "classifying" ? dc.admin.analyzing : null}
                            {item.status === "uploading" ? `${dc.admin.uploading} ${item.progress}%` : null}
                            {item.status === "done" ? dc.admin.done : null}
                            {item.status === "failed" ? dc.admin.failed : null}
                          </span>
                        </div>

                        {item.classification ? (
                          <div className="docs-upload-fields">
                            <label>
                              {dc.admin.title2}
                              <input value={item.title} onChange={(event) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, title: event.target.value } : entry)))} />
                            </label>
                            <label>
                              {dc.admin.region}
                              <select value={item.hints.region ?? ""} onChange={(event) => updateHint(item.id, "region", event.target.value)}>
                                <option value="">—</option>
                                {REGIONS.map((region) => (
                                  <option key={region.id} value={region.id}>
                                    {region.name[language] ?? region.name.vi}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              {dc.admin.province}
                              <select value={item.hints.provinceSlug ?? ""} onChange={(event) => updateHint(item.id, "provinceSlug", event.target.value)}>
                                <option value="">—</option>
                                {PROVINCES.filter((province) => !item.hints.region || province.region === item.hints.region).map((province) => (
                                  <option key={province.slug} value={province.slug}>
                                    {province.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              {dc.admin.zone}
                              <input list="v-tnf-zone-list" value={item.hints.zoneName ?? ""} onChange={(event) => updateHint(item.id, "zoneName", event.target.value)} />
                            </label>
                            <label>
                              {dc.admin.category}
                              <select value={item.hints.category ?? "other"} onChange={(event) => updateHint(item.id, "category", event.target.value)}>
                                {CATEGORIES.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {categoryLabel(category.id, language)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}

                        {item.classification?.reasons?.length ? (
                          <p className="docs-upload-reasons">
                            {dc.admin.suggestion}: {item.classification.reasons.join(" · ")}
                          </p>
                        ) : null}
                        {item.error ? <p className="docs-admin-error">{item.error}</p> : null}
                        {item.status === "uploading" ? (
                          <div className="docs-upload-progress">
                            <i style={{ width: `${item.progress}%` }} />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <datalist id="v-tnf-zone-list">
                    {[...new Set(zoneSuggestions)].map((zoneName) => (
                      <option key={zoneName} value={zoneName} />
                    ))}
                  </datalist>

                  <button type="button" className="docs-primary-link" onClick={uploadAll} disabled={busy}>
                    {dc.admin.start}
                  </button>
                </>
              ) : null}

              {error ? <p className="docs-admin-error">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
