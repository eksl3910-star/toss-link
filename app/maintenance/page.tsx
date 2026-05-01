export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-6">🔧</div>
        <h1 className="text-2xl font-bold text-[#1a1a1a] mb-3">점검 중입니다</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          서버 점검 중이에요.
          <br />
          잠시 후 다시 접속해주세요.
        </p>
        <div className="mt-8 inline-block bg-[#ffe8ea] text-[#ff5a67] text-xs font-bold px-4 py-2 rounded-full">
          MAINTENANCE
        </div>
      </div>
    </main>
  );
}
