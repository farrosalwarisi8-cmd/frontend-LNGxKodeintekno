import Image from "next/image";
import { cn } from "cn";

/**
 * LOGO LNG — satu-satunya lambang merek yang boleh dipakai di UI.
 *
 * Aset asli: `public/brand/lng-flame.png` (383×383, PNG RGBA transparan).
 * Aturan merek:
 *  - Jangan pernah merecolor / memiringkan / meregangkan lambang (dilakukan di
 *    sumber aset, bukan di komponen).
 *  - Lambang tidak boleh berdiri sendiri tanpa nama sistem di dekatnya —
 *    sediakan judul (mis. `<h1>Kodein Klinik</h1>`) di sebelahnya.
 *  - Di latar gelap, bungkus lambang dengan chip terang (`onDark`) agar
 *    tepinya tetap terlihat.
 */

/** Ukuran lambang dalam px. */
const MARK_SIZES = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
  "2xl": 72,
} as const;

export type LogoSize = keyof typeof MARK_SIZES;

export interface LogoProps {
  /** Ukuran lambang (default `md`). */
  size?: LogoSize;
  /**
   * Teks alternatif gambar. Default `""` (dekoratif) dipakai bila nama sistem
   * sudah terbaca di sebelah lambang; isi hanya bila lambang tampil sendirian.
   */
  alt?: string;
  /** Bungkus lambang chip terang (`bg-surface`) untuk latar gelap. */
  onDark?: boolean;
  /** True bila lambang tampil di atas fold (hindari layout shift). */
  priority?: boolean;
  className?: string;
}

export function Logo({
  size = "md",
  alt = "",
  onDark = false,
  priority = false,
  className,
}: LogoProps) {
  const px = MARK_SIZES[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        onDark && "rounded-2xl bg-surface p-1.5",
        className
      )}
    >
      <Image
        src="/brand/lng-flame.png"
        width={383}
        height={383}
        alt={alt}
        priority={priority}
        style={{ width: px, height: px }}
      />
    </span>
  );
}
Logo.displayName = "Logo";