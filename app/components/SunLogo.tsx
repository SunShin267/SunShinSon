type SunLogoProps = {
  compact?: boolean;
};

export function SunLogo({ compact = false }: SunLogoProps) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="sun-mark" aria-hidden="true">
        <span className="sun-face">•ᴗ•</span>
      </span>
      <span className="brand-name">SunShinSon</span>
    </div>
  );
}
