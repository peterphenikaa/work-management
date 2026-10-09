import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-full flex-1 place-items-center bg-[#f7f8f9] px-5 text-[#172b4d]">
      <section className="w-full max-w-md rounded-lg border border-[#dfe1e6] bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Quên mật khẩu</h1>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#0052cc]">
          Về đăng nhập
        </Link>
      </section>
    </main>
  );
}
