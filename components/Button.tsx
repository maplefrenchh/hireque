import Link from "next/link";

type ButtonProps = {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export default function Button({ href, children, variant = "primary" }: ButtonProps) {
  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-500"
      : "inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 font-bold text-slate-200 hover:bg-white/10";

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return <button className={className}>{children}</button>;
}