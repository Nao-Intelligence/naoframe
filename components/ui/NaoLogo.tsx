import Image from "next/image";

export function NaoLogo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/nao-logo.svg"
      alt="Nao Intelligence"
      width={220}
      height={60}
      className={className ?? "h-8 w-auto"}
      priority={priority}
    />
  );
}
