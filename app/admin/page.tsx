"use client";

import { useEffect, useState } from "react";

type Settings = { maintenanceOn: boolean; touchedAt: number };
type Metrics = {
  totalUsers: number;
  newUsersToday: number;
  totalLinks: number;
  queuedLinks: number;
  consumedLinks: number;
};

type AlertState = { message: string; type: "error" | "success" | "info" } | null;

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <p className={`mt-3 text-sm rounded-xl border px-3 py-2 ${styles[state.type]}`}>
      {state.message}
    </p>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState<AlertState>(null);

  // Load current settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json() as Promise<Partial<Settings>>)
      .then((d) => {
        setSettings({
          maintenanceOn: Boolean(d.maintenanceOn),
          touchedAt: d.touchedAt ?? 0,
        });
      })
      .catch(() =>
        setAlert({ message: "설정을 불러오지 못했습니다.", type: "error" })
      )
      .finally(() => setLoading(false));
  }, []);

  async function toggleMaintenance(next: boolean) {
    if (busy) return;
    setAlert(null);

    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, on: next }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        maintenanceOn?: boolean;
        touchedAt?: number;
      };

      if (!res.ok || !data.ok) {
        setAlert({ message: data.error ?? "업데이트 실패", type: "error" });
        return;
      }

      setSettings({ maintenanceOn: Boolean(data.maintenanceOn), touchedAt: data.touchedAt ?? 0 });
      setAlert({
        message: next ? "점검 모드가 활성화됐습니다." : "점검 모드가 해제됐습니다.",
        type: "success",
      });
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function loadStats() {
    setAlert(null);
    if (!password) {
      setAlert({ message: "관리자 비밀번호를 입력해주세요.", type: "error" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; metrics?: Metrics };

      if (!res.ok || !data.ok) {
        setAlert({ message: data.error ?? "통계 조회 실패", type: "error" });
        return;
      }

      setMetrics(data.metrics ?? null);
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const isMaintenance = settings?.maintenanceOn ?? false;

  return (
    <main className="min-h-screen bg-white px-5 py-10">
      <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-[#e7e9ee] bg-white p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1f2430]">관리자</h1>
        <p className="mt-2 text-sm text-[#7c8394]">서버 점검 모드와 통계를 관리해요.</p>

        {/* Password input */}
        <div className="mt-6 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <label className="mb-4 block">
            <p className="mb-2 text-xs font-semibold text-[#1f2430]">관리자 비밀번호</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="h-11 w-full rounded-xl border border-[#d9dde6] bg-white px-3 text-sm text-[#1f2430] outline-none placeholder:text-[#9aa3b2] focus:border-[#111] transition-colors"
            />
          </label>

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1f2430]">현재 상태</p>
              <p className="mt-1 text-xs text-[#7c8394]">
                {loading ? "불러오는 중..." : isMaintenance ? "점검 중 (전체 차단)" : "정상 운영"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isMaintenance
                  ? "bg-[#ffe8ea] text-[#ff5a67]"
                  : "bg-[#e9fbf0] text-[#14a44d]"
              }`}
            >
              {isMaintenance ? "MAINTENANCE" : "LIVE"}
            </span>
          </div>

          <Alert state={alert} />

          {/* Toggle buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              disabled={loading || busy || isMaintenance}
              onClick={() => void toggleMaintenance(true)}
              className="h-12 rounded-xl bg-[#111] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              서버 전체 중단
            </button>
            <button
              disabled={loading || busy || !isMaintenance}
              onClick={() => void toggleMaintenance(false)}
              className="h-12 rounded-xl border border-[#e7e9ee] bg-white text-base font-bold text-[#1f2430] disabled:cursor-not-allowed disabled:opacity-40"
            >
              점검 해제
            </button>
          </div>
        </div>

        {/* Stats section */}
        <div className="mt-4 rounded-xl border border-[#e7e9ee] bg-[#fbfbfd] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#1f2430]">통계</p>
            <button
              onClick={() => void loadStats()}
              disabled={busy}
              className="text-xs text-[#7c8394] border border-[#d9dde6] rounded-lg px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              조회
            </button>
          </div>

          {metrics ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "전체 유저", value: metrics.totalUsers },
                { label: "오늘 가입", value: metrics.newUsersToday },
                { label: "전체 링크", value: metrics.totalLinks },
                { label: "대기 중", value: metrics.queuedLinks },
                { label: "소비됨", value: metrics.consumedLinks },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-xl border border-[#e7e9ee] px-3 py-3"
                >
                  <p className="text-xs text-[#7c8394]">{item.label}</p>
                  <p className="text-xl font-bold text-[#1f2430] mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9aa3b2]">비밀번호를 입력하고 조회를 눌러주세요.</p>
          )}
        </div>

        <p className="mt-6 text-xs text-[#7c8394]">
          점검 모드 전환 시 일반 유저는 /maintenance 페이지로 이동됩니다.
        </p>
      </div>
    </main>
  );
}
