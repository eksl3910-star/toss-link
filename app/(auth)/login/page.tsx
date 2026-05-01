"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Tab = "login" | "register";

type AlertState = { message: string; type: "error" | "success" } | null;

const NICKNAME_PATTERN = /^[a-zA-Z0-9\uAC00-\uD7A3\u3131-\u318E]+$/;

function normalizeNicknameInput(raw: string): string {
  return raw.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function validateNicknameClient(normalized: string): string | null {
  if (normalized.length < 2) return "닉네임은 2자 이상이어야 합니다.";
  if (normalized.length > 20) return "닉네임은 20자 이하여야 합니다.";
  if (!NICKNAME_PATTERN.test(normalized)) {
    return "닉네임은 영어, 한글, 숫자만 사용할 수 있습니다.";
  }
  return null;
}

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  const base = "rounded-xl px-4 py-3 text-sm mb-4";
  const styles =
    state.type === "error"
      ? `${base} bg-red-50 text-red-700 border border-red-200`
      : `${base} bg-green-50 text-green-700 border border-green-200`;
  return <div className={styles}>{state.message}</div>;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    const normalized = normalizeNicknameInput(nickname);
    const nickErr = validateNicknameClient(normalized);
    if (nickErr) {
      setAlert({ message: nickErr, type: "error" });
      setLoading(false);
      return;
    }

    if (tab === "register") {
      if (password.length < 8) {
        setAlert({ message: "비밀번호는 8자 이상이어야 합니다.", type: "error" });
        setLoading(false);
        return;
      }
      if (password !== passwordConfirm) {
        setAlert({ message: "비밀번호 확인이 일치하지 않습니다.", type: "error" });
        setLoading(false);
        return;
      }
    }

    const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tab === "register"
            ? { nickname: normalized, password, passwordConfirm }
            : { nickname: normalized, password }
        ),
      });

      const text = await res.text();
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        setAlert({
          message: `서버 응답을 처리할 수 없습니다. (HTTP ${res.status})`,
          type: "error",
        });
        return;
      }

      if (!res.ok || !data.ok) {
        setAlert({ message: data.error ?? "오류가 발생했습니다.", type: "error" });
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setAlert({
        message: "연결에 실패했습니다. 네트워크와 서버 상태를 확인해주세요.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a1a1a]">에이블리 링크 교환</h1>
          <p className="text-sm text-gray-500 mt-2">링크를 올리고 받아요</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm">
          <div className="flex rounded-xl bg-[#f5f5f7] p-1 mb-6">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setAlert(null);
                  setPasswordConfirm("");
                }}
                className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${
                  tab === t
                    ? "bg-white text-[#1a1a1a] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          <Alert state={alert} />

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">닉네임</label>
              <input
                type="text"
                autoComplete="username"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="영어·한글·숫자 (2~20자)"
                maxLength={20}
                className="w-full h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "8자 이상" : "비밀번호 입력"}
                minLength={tab === "register" ? 8 : 1}
                className="w-full h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300"
              />
            </div>

            {tab === "register" ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호 확인</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  minLength={8}
                  className="w-full h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300"
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#ff5a5f] text-white font-bold text-base mt-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e04448] transition-colors active:scale-[0.98]"
            >
              {loading ? "처리 중..." : tab === "login" ? "로그인" : "가입하기"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
