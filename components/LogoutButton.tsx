"use client";

export default function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem("hireque_access_token");
    localStorage.removeItem("hireque_user_email");
    document.cookie = "hireque_access_token=; path=/; max-age=0";
    window.location.href = "/";
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/20"
    >
      Sign Out
    </button>
  );
}