import fscLogoMark from "@/assets/fsc-logo-mark.png";

// The one FSC logo. The artwork has a white background, so it always sits on a white tile
// (see .brand-logo in styles.css), which keeps it identical on every theme. Size comes from `className`.
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={fscLogoMark}
      alt="FSC logo"
      width={480}
      height={339}
      className={`brand-logo ${className}`.trim()}
    />
  );
}
