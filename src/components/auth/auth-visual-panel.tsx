import Image from "next/image";

export function AuthVisualPanel() {
  return (
    <div className="aksa-auth-background">
      <Image
        alt=""
        className="aksa-auth-background__image"
        fill
        priority
        quality={95}
        sizes="100vw"
        src="/auth.webp"
      />
      <div className="aksa-auth-background__overlay" />
    </div>
  );
}
