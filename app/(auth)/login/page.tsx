"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type Tab = "login" | "register";

type AlertState = { message: string; type: "error" | "success" } | null;

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setAlert({ message: data.error ?? "오류가 발생했습니다.", type: "error" });
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setAlert({ message: "네트워크 오류가 발생했습니다.", type: "error" });
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
          {/* Tab Switch */}
          <div className="flex rounded-xl bg-[#f5f5f7] p-1 mb-6">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setAlert(null); }}
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
              <label className="block text-xs font-semibold text-gray-600 mb-1">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "8자 이상" : "비밀번호 입력"}
                minLength={tab === "register" ? 8 : 1}
                className="w-full h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm outline-none focus:border-[#ff5a5f] transition-colors placeholder:text-gray-300"
              />
            </div>

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
