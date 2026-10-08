/**
 * Penggabung className.
 *
 * Memakai paket `cn` (sudah menjadi dependency proyek, dipakai juga oleh
 * komponen `components/ui/*`) yang merupakan clsx + tailwind-merge.
 *
 * Penting: clsx saja menghasilkan konflik kelas yang tidak deterministik
 * (pemenang ditentukan urutan di stylesheet, bukan urutan argumen), sehingga
 * override seperti `<CardContent className="p-4">` di atas base `p-6` diam-diam
 * diabaikan. Dengan merge, kelas terakhir yang menang — sesuai maksud penulisnya.
 */
export { cn } from "cn";
