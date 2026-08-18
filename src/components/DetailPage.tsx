"use client";

import { useEffect, useState } from "react";
import { PulseShell } from "./PulseShell";

export function DetailPage({ type, id }: { type: "actions" | "goals"; id: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/${type}/${encodeURIComponent(id)}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "اطلاعات یافت نشد.");
      setRecord(body);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "اطلاعات یافت نشد."));
  }, [id, type]);
  return <PulseShell><div className="page"><div className="page-heading"><div><div className="eyebrow">جزئیات و پیگیری</div><h1>{type === "actions" ? "جزئیات اقدام" : "جزئیات هدف"}</h1><p>{id}</p></div></div>{error ? <div className="empty">{error}</div> : !record ? <div className="empty">در حال دریافت اطلاعات...</div> : <div className="panel detail-card">{Object.entries(record).map(([key, value]) => <div className="detail-field" key={key}><span>{key}</span><strong>{String(value ?? "—")}</strong></div>)}</div>}</div></PulseShell>;
}
