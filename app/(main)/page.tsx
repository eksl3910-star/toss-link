"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertType = "success" | "error" | "warning" | "info";
type AlertState = { message: string; type: AlertType } | null;

type LinkStats = { total: number; mine: number };
type ClaimedLink = { id: string; url: string; deadline: number };
type User = { id: string; nickname: string };

async function readResponseJson<T>(res: Response): Promise<{ data: T | null; status: number }> {
  const raw = await res.text();
  if (!raw.trim()) return { data: null, status: res.status };
  try {
    return { data: JSON.parse(raw) as T, status: res.status };
  } catch {
    return { data: null, status: res.status };
  }
}

// ── Alert component ───────────────────────────────────────────────────────────

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  const styles: Record<AlertType, string> = {
    success: "bg-[#e8faf0] text-[#1a7a45] border-[#c3f0d8]",
    error: "bg-[#fff0f0] text-[#c0392b] border-[#ffd6d6]",
    warning: "bg-[#fff8e8] text-[#b07800] border-[#ffe4a0]",
    info: "bg-[#eef4ff] text-[#2355b0] border-[#c7d9ff]",
  };
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm border leading-relaxed mb-3 ${styles[state.type]}`}
    >
      {state.message}
    </div>
  );
}

// ── Guide popup ───────────────────────────────────────────────────────────────

function GuidePopup({ onClose }: { onClose: () => void }) {
  const handleDontShow = () => {
    localStorage.setItem("als_guide_done", "1");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl p-6 pb-9 w-full max-w-[480px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#1a1a1a]">사용방법</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f0f0f0] flex items-center justify-center text-base"
          >
            ✕
          </button>
        </div>

        {[
          {
            n: 1,
            title: "에이블리에서 내 링크 복사하기",
            desc: "에이블리 앱에서 이벤트 링크를 새로 만들고 복사해요. 카카오톡으로 받은 메시지 전체를 복사해도 돼요!",
          },
          {
            n: 2,
            title: "텍스트 박스에 붙여넣고 올리기",
            desc: "링크를 텍스트 박스에 붙여넣거나 입력하고 '링크 올리기' 버튼을 눌러요.",
          },
          {
            n: 3,
            title: "빨간 버튼으로 남의 링크 받기",
            desc: "버튼을 누르면 다른 사람 링크 1개가 나한테만 와요. 받으면 5초 안에 눌러야 해요!",
          },
          {
            n: 4,
            title: "반복하면 응모 티켓이 쌓여요",
            desc: "에이블리에서 새 링크 만들고 → 올리고 → 받기. 이걸 반복하면 돼요!",
          },
        ].map((step) => (
          <div key={step.n} className="flex gap-4 mb-5">
            <div className="w-7 h-7 min-w-[28px] rounded-full bg-[#ff5a5f] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {step.n}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a] mb-1">{step.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}

        <hr className="border-[#f0f0f0] my-5" />

        <div className="bg-[#f7f7f7] rounded-xl p-4 mb-5 space-y-2">
          {[
            "⚡ 동시에 눌러도 딱 1명만 받을 수 있어요",
            "🚫 한 사람 링크는 딱 1번만 받을 수 있어요",
            "⏱️ 5초 안에 안 누르면 자동으로 반납돼요",
            "🔗 에이블리 링크(a-bly.com)만 올릴 수 있어요",
            "🔄 내 링크를 대기열 맨 앞으로 다시 올릴 수 있어요",
          ].map((item) => (
            <p key={item} className="text-xs text-[#555] leading-relaxed">
              {item}
            </p>
          ))}
        </div>

        <button
          onClick={handleDontShow}
          className="w-full h-12 rounded-xl bg-[#1a1a1a] text-white font-semibold text-sm mb-2"
        >
          다시 보지 않기
        </button>
        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-[#f5f5f5] text-gray-500 text-sm"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<LinkStats>({ total: 0, mine: 0 });

  // Upload section
  const [linkText, setLinkText] = useState("");
  const [uploadAlert, setUploadAlert] = useState<AlertState>(null);
  const [uploading, setUploading] = useState(false);
  const [showRequeue, setShowRequeue] = useState(false);

  // Receive section
  const [receiveAlert, setReceiveAlert] = useState<AlertState>(null);
  const [receiving, setReceiving] = useState(false);

  // Claimed link display
  const [claimedLink, setClaimedLink] = useState<ClaimedLink | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [isUrgent, setIsUrgent] = useState(false);

  // Guide popup
  const [showGuide, setShowGuide] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load current user ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ ok?: boolean; user?: User }>)
      .then((d) => {
        if (d.ok && d.user) {
          setUser(d.user);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // ── Load stats ──────────────────────────────────────────────────────────────

  const loadStats = useCallback(() => {
    fetch("/api/links/stats")
      .then((r) => r.json() as Promise<{ ok?: boolean; total?: number; mine?: number }>)
      .then((d) => {
        if (d.ok) setStats({ total: d.total ?? 0, mine: d.mine ?? 0 });
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      loadStats();
      if (!localStorage.getItem("als_guide_done")) {
        setTimeout(() => setShowGuide(true), 400);
      }
    }
  }, [authLoading, user, loadStats]);

  // ── Timer cleanup ───────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // ── Delete account ──────────────────────────────────────────────────────────

  async function handleDeleteAccount() {
    if (!confirm("정말로 계정을 삭제하시겠어요? 내 링크도 모두 삭제됩니다.")) return;
    const res = await fetch("/api/auth/delete", { method: "DELETE" });
    if (res.ok) {
      router.push("/login");
    }
  }

  // ── Submit link ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setUploadAlert(null);
    const text = linkText.trim();
    if (!text) {
      setUploadAlert({ message: "에이블리 링크를 입력해주세요.", type: "warning" });
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/links/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const { data } = await readResponseJson<{ ok?: boolean; error?: string }>(res);

      if (!data) {
        setUploadAlert({
          message: `서버 응답을 읽을 수 없습니다. (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      if (!res.ok || !data.ok) {
        setUploadAlert({ message: data.error ?? "업로드 오류가 발생했습니다.", type: "error" });
        return;
      }

      setLinkText("");
      setShowRequeue(true);
      setUploadAlert({ message: "링크가 올라갔어요! 🎉", type: "success" });
      loadStats();
    } catch {
      setUploadAlert({ message: "연결에 실패했습니다. 네트워크를 확인해주세요.", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  // ── Requeue ─────────────────────────────────────────────────────────────────

  async function handleRequeue() {
    const res = await fetch("/api/links/requeue", { method: "POST" });
    const data = (await res.json()) as { ok?: boolean; reason?: string };

    if (!res.ok || !data.ok) {
      const msg =
        data.reason === "NO_QUEUED_LINK"
          ? "대기 중인 내 링크가 없어요."
          : "오류가 발생했습니다.";
      setUploadAlert({ message: msg, type: "info" });
      return;
    }
    setUploadAlert({ message: "내 링크가 대기열 맨 앞으로 이동됐어요! 🔄", type: "success" });
  }

  // ── Receive link ─────────────────────────────────────────────────────────────

  async function handleReceive() {
    setReceiveAlert(null);
    setReceiving(true);

    try {
      const res = await fetch("/api/links/claim", { method: "POST" });
      const { data } = await readResponseJson<{
        ok?: boolean;
        reason?: string;
        error?: string;
        link?: ClaimedLink;
      }>(res);

      if (!data) {
        setReceiveAlert({
          message: `서버 응답을 읽을 수 없습니다. (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      if (!res.ok) {
        setReceiveAlert({
          message: data.error ?? "링크를 받지 못했어요.",
          type: res.status === 401 ? "warning" : "error",
        });
        return;
      }

      if (!data.ok) {
        const msg =
          data.reason === "NO_LINK"
            ? "지금 받을 수 있는 링크가 없어요."
            : data.reason === "RACE"
              ? "다른 사람이 먼저 받았어요. 다시 눌러주세요."
              : "링크를 받지 못했어요.";
        setReceiveAlert({ message: msg, type: "info" });
        return;
      }

      if (data.link) {
        startCountdown(data.link);
      }
    } catch {
      setReceiveAlert({
        message: "연결에 실패했습니다. 네트워크를 확인해주세요.",
        type: "error",
      });
    } finally {
      setReceiving(false);
    }
  }

  // ── Countdown timer ──────────────────────────────────────────────────────────

  function startCountdown(link: ClaimedLink) {
    setClaimedLink(link);
    setCountdown(5);
    setIsUrgent(false);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 2) setIsUrgent(true);
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          void autoReturn(link.id);
          return 0;
        }
        return next;
      });
    }, 1000);
  }

  async function autoReturn(linkId: string) {
    await fetch("/api/links/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    resetDisplay();
  }

  function resetDisplay() {
    if (timerRef.current) clearInterval(timerRef.current);
    setClaimedLink(null);
    setCountdown(5);
    setIsUrgent(false);
    setReceiving(false);
    setReceiveAlert(null);
    loadStats();
  }

  // ── Open received link (consume) ─────────────────────────────────────────────

  async function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    if (!claimedLink) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const url = claimedLink.url;
    const linkId = claimedLink.id;

    await fetch("/api/links/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });

    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => resetDisplay(), 300);
  }

  // ── Manual return ─────────────────────────────────────────────────────────────

  async function handleReturn() {
    if (!claimedLink) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await fetch("/api/links/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId: claimedLink.id }),
    });
    resetDisplay();
  }

  // ── Paste from clipboard ─────────────────────────────────────────────────────

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setLinkText(text);
    } catch {
      setUploadAlert({
        message: "붙여넣기 권한이 필요해요. 브라우저에서 클립보드 접근을 허용해주세요.",
        type: "warning",
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-[480px] mx-auto pb-10">

          {/* Top bar */}
          <header className="bg-white border-b border-[#e8e8e8] px-5 py-4 flex items-center justify-between sticky top-0 z-10">
            <h1 className="text-base font-semibold text-[#1a1a1a]">에이블리 링크 교환</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {user?.nickname}
              </span>
              <button
                onClick={() => setShowGuide(true)}
                className="border border-[#e0e0e0] rounded-full px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
              >
                사용방법
              </button>
              <button
                onClick={() => void handleLogout()}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                로그아웃
              </button>
            </div>
          </header>

          <div className="px-4 pt-4 space-y-3">

            {/* Stats */}
            <button
              onClick={loadStats}
              className="w-full bg-white rounded-2xl border border-[#ececec] p-4 flex items-center justify-center gap-2 active:bg-gray-50"
            >
              <span className="text-2xl font-bold text-[#ff5a5f]">{stats.total}</span>
              <span className="text-sm text-gray-500">개의 링크 대기 중</span>
              <span className="text-xs text-gray-300 ml-1">↻</span>
            </button>

            {/* Upload card */}
            <div className="bg-white rounded-2xl border border-[#ececec] p-4">
              <p className="text-xs font-semibold text-gray-400 mb-3">내 링크 올리기</p>

              <textarea
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="에이블리 링크를 붙여넣어주세요 (a-bly.com)"
                rows={3}
                className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm resize-none outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300 mb-2"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => void handlePaste()}
                  className="flex-1 h-10 rounded-xl border border-[#e5e7eb] text-sm text-gray-500 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  📋 붙여넣기
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={uploading}
                  className="flex-1 h-10 rounded-xl bg-[#ff5a5f] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#e04448] active:scale-[0.98] transition-all"
                >
                  {uploading ? "업로드 중..." : "링크 올리기"}
                </button>
              </div>

              {showRequeue && (
                <button
                  onClick={() => void handleRequeue()}
                  className="w-full h-10 rounded-xl border border-[#e5e7eb] text-sm text-gray-500 mt-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  🔄 내 링크 대기열 맨 앞으로 다시 올리기
                </button>
              )}

              {uploadAlert && <div className="mt-2"><Alert state={uploadAlert} /></div>}
            </div>

            {/* Receive section */}
            {!claimedLink && (
              <div>
                {receiveAlert && <Alert state={receiveAlert} />}
                <button
                  onClick={() => void handleReceive()}
                  disabled={receiving}
                  className="w-full h-16 rounded-2xl bg-[#ff5a5f] text-white text-lg font-bold shadow-[0_4px_16px_rgba(255,90,95,0.25)] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.97] transition-all"
                >
                  {receiving ? "받는 중..." : "다음 링크 받기"}
                </button>
              </div>
            )}

            {/* Claimed link display */}
            {claimedLink && (
              <div className="bg-white rounded-2xl border-2 border-[#ff5a5f] p-5">
                <p className="text-xs text-gray-400 mb-2">받은 링크</p>
                <div className="bg-[#f7f7f7] rounded-xl px-3 py-2.5 text-xs text-gray-500 break-all mb-4">
                  {claimedLink.url}
                </div>

                <div className="text-center mb-4">
                  <div
                    className={`text-5xl font-bold leading-none ${
                      isUrgent ? "text-[#ff5a5f]" : "text-[#1a1a1a]"
                    }`}
                  >
                    {countdown}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">초 안에 누르지 않으면 자동 반납돼요</p>
                </div>

                <button
                  onClick={(e) => void handleOpen(e)}
                  className="block w-full h-13 leading-[52px] text-center bg-[#ff5a5f] text-white rounded-xl text-base font-bold mb-2.5 hover:bg-[#e04448] transition-colors active:scale-[0.98]"
                  style={{ height: "52px" }}
                >
                  에이블리에서 열기 →
                </button>

                <button
                  onClick={() => void handleReturn()}
                  className="w-full h-10 rounded-xl bg-[#f5f5f5] text-gray-500 text-sm active:scale-[0.98]"
                >
                  반납하기
                </button>
              </div>
            )}

            {/* Account management */}
            <div className="pt-2 pb-4">
              <button
                onClick={() => void handleDeleteAccount()}
                className="w-full text-xs text-gray-300 hover:text-red-400 transition-colors py-2"
              >
                계정 탈퇴
              </button>
            </div>

          </div>
        </div>
      </div>

      {showGuide && <GuidePopup onClose={() => setShowGuide(false)} />}
    </>
  );
}
