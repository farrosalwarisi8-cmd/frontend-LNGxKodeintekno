/**
 * Font tipografi aplikasi — system font stack.
 *
 * Repo ini tidak menyimpan berkas font (woff2/ttf), dan next/font/google
 * membutuhkan akses internet saat build, sehingga aplikasi memakai system
 * font stack agar tetap berfungsi offline. Hierarki tipografi (ukuran,
 * bobot, jarak) diatur lewat token `--text-*` / `--leading-*` di
 * `app/globals.css`.
 *
 * `inter.className` = `font-sans`, dan `--font-sans` didefinisikan langsung
 * di `app/globals.css`. Catatan perbaikan: variabel `--font-inter` TIDAK
 * didefinisikan di mana pun — dulu `--font-sans` merujuknya tanpa fallback,
 * sehingga seluruh deklarasi `font-family` menjadi invalid pada computed
 * value dan teks jatuh ke font serif bawaan browser.
 */
export const inter = {
  className: "font-sans",
};