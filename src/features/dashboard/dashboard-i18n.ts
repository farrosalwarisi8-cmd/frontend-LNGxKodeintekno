import type { Language } from "@/lib/i18n";

/**
 * Terjemahan konten Dashboard.
 *
 * Kunci peta adalah teks Indonesia yang sudah ada di data dashboard
 * (`role-tasks.ts` dan `dashboard-metrics.ts`), sehingga sumber data tidak
 * perlu diubah dan penambahan bahasa cukup di satu tempat. Teks yang belum
 * ada di peta jatuh kembali ke Bahasa Indonesia.
 */
const EN: Record<string, string> = {
  // Fokus peran
  "Layani pendaftaran dan antrean secepat mungkin.":
    "Handle registration and the queue as quickly as possible.",
  "Siapkan pasien: registrasi, antrean, dan TTV.":
    "Prepare patients: registration, queue, and vital signs.",
  "Selesaikan SOAP dan review MCU hari ini.": "Complete SOAP and review MCU today.",
  "Tulis SOAP pasien klinik, lalu kunci rekam medis.":
    "Write clinic patient SOAP, then lock the medical record.",
  "Dispensing resep dengan perhatian pada stok dan FEFO.":
    "Dispense prescriptions with attention to stock and FEFO.",
  "Pastikan MCU pekerja tidak lewat jatuh tempo.":
    "Make sure employee MCUs do not pass their due date.",
  "Pantau FTW, restriction, dan MCU jatuh tempo.":
    "Monitor FTW, restrictions, and MCUs due soon.",
  "Lihat ringkasan kesehatan kerja seluruh site.":
    "View occupational health summaries for all sites.",
  "Masukkan hasil lab dan D&A tepat waktu.": "Enter lab and D&A results on time.",
  "Jaga data induk dan akses pengguna tetap rapi.":
    "Keep master data and user access in order.",
  "Lihat status kesehatan dan dokumen Anda.": "View your health status and documents.",
  "Ringkasan aktivitas klinik.": "Clinic activity summary.",

  // Label tindakan
  "Kunjungan baru": "New visit",
  Antrean: "Queue",
  "MCU baru": "New MCU",
  "Riwayat kunjungan": "Visit history",
  "Status kesehatan": "Health status",
  "Tulis SOAP": "Write SOAP",
  "Review MCU": "MCU review",
  Sertifikat: "Certificate",
  "Hasil lab": "Lab results",
  "Daftar kunjungan": "Visit list",
  "MCU & FTW": "MCU & FTW",
  Dispensing: "Dispensing",
  "Retur obat": "Medicine return",
  "Stok & FEFO": "Stock & FEFO",
  Waiver: "Waiver",
  Laporan: "Reports",
  "MCU jatuh tempo": "MCU due",
  "Direktori pekerja": "Employee directory",
  "Buat MCU": "Create MCU",
  "Status kesehatan saya": "My health status",
  "Sertifikat saya": "My certificates",
  "Notifikasi saya": "My notifications",
  "Profil saya": "My profile",
  "Input hasil lab": "Enter lab results",
  "D&A": "D&A",
  "Status Kesehatan": "Health status",
  Pengguna: "Users",
  "Master data": "Master data",
  "Registrasi & consent": "Registration & consent",
  "Audit log": "Audit log",

  // Deskripsi tindakan
  "Daftarkan pasien dan catat TTV": "Register the patient and record vital signs",
  "Panggil pasien berikutnya": "Call the next patient",
  "Catat TTV & hasil pemeriksaan MCU": "Record vital signs & MCU examination results",
  "Lihat kunjungan yang sedang berjalan": "View visits currently in progress",
  "Cek Fitness to Work pekerja": "Check employee Fitness to Work",
  "Isi SOAP, diagnosis ICD-10, lalu kunci rekam medis":
    "Fill in SOAP, ICD-10 diagnosis, then lock the medical record",
  "Setujui MCU yang menunggu dokter": "Approve MCUs waiting for a doctor",
  "Terbitkan sertifikat kesehatan kerja": "Issue occupational health certificates",
  "Tetapkan FTW & restriction": "Set FTW & restrictions",
  "Baca hasil lab & radiologi": "Read lab & radiology results",
  "Buka siklus MCU untuk pasien klinik": "Open an MCU cycle for a clinic patient",
  "Kunjungan klinik yang sedang berjalan": "Clinic visits currently in progress",
  "Siklus MCU pekerja": "Employee MCU cycles",
  "Proses resep menunggu (FEFO)": "Process pending prescriptions (FEFO)",
  "Catat obat yang dikembalikan": "Record returned medicines",
  "Pantau stok rendah dan batch mendekati kadaluarsa":
    "Monitor low stock and batches nearing expiry",
  "Pantau FTW, restriction, dan MCU jatuh tempo":
    "Monitor FTW, restrictions, and MCUs due soon",
  "Kelola pengajuan waiver HSE": "Manage HSE waiver requests",
  "Unduh laporan kesehatan kerja": "Download occupational health reports",
  "Lihat siklus MCU pekerja": "View employee MCU cycles",
  "Pekerja yang MCU-nya harus dijadwalkan": "Employees whose MCU must be scheduled",
  "Cari pekerja dan kelola dokumen": "Find employees and manage documents",
  "Jadwalkan siklus pemeriksaan pekerja": "Schedule employee examination cycles",
  "Ekspor rekap untuk manajemen": "Export summaries for management",
  "Fitness to Work & hasil MCU terakhir": "Fitness to Work & latest MCU results",
  "Unduh sertifikat kesehatan kerja": "Download occupational health certificates",
  "Pengingat MCU dan surat": "MCU reminders and letters",
  "Periksa data pribadi & kontak": "Check personal data & contacts",
  "Catat hasil laboratorium & radiologi": "Record laboratory & radiology results",
  "Catat hasil Drug & Alcohol": "Record Drug & Alcohol results",
  "Status kepatuhan FTW & restriction": "FTW & restriction compliance status",
  "Kelola akun dan peran": "Manage accounts and roles",
  "Site, unit, job task, katalog ICD-10": "Sites, units, job tasks, ICD-10 catalogue",
  "Pendaftaran pekerja dan consent digital": "Employee registration and digital consent",
  "Telusuri aktivitas sistem": "Trace system activity",
  "Pantau FTW seluruh site": "Monitor FTW across all sites",
  "Rekap MCU, FTW, dan kunjungan": "MCU, FTW, and visit summaries",
  "Distribusi Fitness to Work": "Fitness to Work distribution",
  "Siklus MCU pekerja seluruh site": "Employee MCU cycles across all sites",

  // Kartu angka
  "Total pekerja": "Total employees",
  "MCU menunggu dokter": "MCU awaiting doctor",
  "MCU jatuh tempo ≤ 30 hari": "MCU due within 30 days",
  "Kunjungan hari ini": "Visits today",
  "Antrean menunggu": "Waiting in queue",
  "Sertifikat valid": "Valid certificates",
  "Fit to Work": "Fit to Work",
  "Fit with Restriction": "Fit with Restriction",
  "Memiliki restriction": "Has restrictions",
  "Stok rendah": "Low stock",
  "Resep menunggu dispensing": "Prescriptions awaiting dispensing",
  "Status FTW saya": "My FTW status",
  "Berlaku sampai": "Valid until",
  "MCU saya menunggu": "My MCU pending",
  "Order lab menunggu": "Pending lab orders",
  "Hasil lab tersedia": "Lab results available",

  // Teks antarmuka
  "Halo,": "Hello,",
  "Muat ulang": "Reload",
  notifikasi: "notifications",
  "Tindakan cepat": "Quick actions",
  "Sebagian ringkasan gagal dimuat dari backend": "Some summaries failed to load from the backend",
  "Coba lagi": "Try again",
  "Ruang saya": "My space",
  "MCU terbaru": "Latest MCU",
  "Belum ada data MCU.": "No MCU data yet.",
  "Kunjungan berjalan": "Ongoing visits",
  "Tidak ada kunjungan berjalan.": "No ongoing visits.",
  "Tidak diketahui": "Unknown",
};

const ZH: Record<string, string> = {
  // 角色重点
  "Layani pendaftaran dan antrean secepat mungkin.": "尽快处理登记和候诊队列。",
  "Siapkan pasien: registrasi, antrean, dan TTV.": "准备患者：登记、排队和生命体征。",
  "Selesaikan SOAP dan review MCU hari ini.": "今天完成 SOAP 并审核 MCU。",
  "Tulis SOAP pasien klinik, lalu kunci rekam medis.": "书写门诊患者 SOAP，然后锁定病历。",
  "Dispensing resep dengan perhatian pada stok dan FEFO.": "发药时注意库存和 FEFO。",
  "Pastikan MCU pekerja tidak lewat jatuh tempo.": "确保员工 MCU 不逾期。",
  "Pantau FTW, restriction, dan MCU jatuh tempo.": "监控 FTW、工作限制和到期 MCU。",
  "Lihat ringkasan kesehatan kerja seluruh site.": "查看所有场地的职业健康汇总。",
  "Masukkan hasil lab dan D&A tepat waktu.": "及时录入化验和药物酒精检测结果。",
  "Jaga data induk dan akses pengguna tetap rapi.": "维护主数据和用户权限的整洁。",
  "Lihat status kesehatan dan dokumen Anda.": "查看您的健康状态和文件。",
  "Ringkasan aktivitas klinik.": "门诊活动汇总。",

  // 操作标签
  "Kunjungan baru": "新就诊",
  Antrean: "候诊队列",
  "MCU baru": "新建 MCU",
  "Riwayat kunjungan": "就诊记录",
  "Status kesehatan": "健康状态",
  "Tulis SOAP": "书写 SOAP",
  "Review MCU": "MCU 审核",
  Sertifikat: "证书",
  "Hasil lab": "化验结果",
  "Daftar kunjungan": "就诊列表",
  "MCU & FTW": "MCU 与 FTW",
  Dispensing: "发药",
  "Retur obat": "退药",
  "Stok & FEFO": "库存与 FEFO",
  Waiver: "豁免",
  Laporan: "报表",
  "MCU jatuh tempo": "到期 MCU",
  "Direktori pekerja": "员工名录",
  "Buat MCU": "创建 MCU",
  "Status kesehatan saya": "我的健康状态",
  "Sertifikat saya": "我的证书",
  "Notifikasi saya": "我的通知",
  "Profil saya": "我的资料",
  "Input hasil lab": "录入化验结果",
  "D&A": "药物与酒精",
  "Status Kesehatan": "健康状态",
  Pengguna: "用户",
  "Master data": "主数据",
  "Registrasi & consent": "登记与同意",
  "Audit log": "审计日志",

  // 操作说明
  "Daftarkan pasien dan catat TTV": "登记患者并记录生命体征",
  "Panggil pasien berikutnya": "呼叫下一位患者",
  "Catat TTV & hasil pemeriksaan MCU": "记录生命体征和 MCU 检查结果",
  "Lihat kunjungan yang sedang berjalan": "查看进行中的就诊",
  "Cek Fitness to Work pekerja": "检查员工的 Fitness to Work",
  "Isi SOAP, diagnosis ICD-10, lalu kunci rekam medis": "填写 SOAP、ICD-10 诊断，然后锁定病历",
  "Setujui MCU yang menunggu dokter": "批准等待医生的 MCU",
  "Terbitkan sertifikat kesehatan kerja": "签发职业健康证书",
  "Tetapkan FTW & restriction": "设定 FTW 和工作限制",
  "Baca hasil lab & radiologi": "阅读化验和放射结果",
  "Buka siklus MCU untuk pasien klinik": "为门诊患者开启 MCU 周期",
  "Kunjungan klinik yang sedang berjalan": "进行中的门诊就诊",
  "Siklus MCU pekerja": "员工 MCU 周期",
  "Proses resep menunggu (FEFO)": "处理待发处方（FEFO）",
  "Catat obat yang dikembalikan": "记录退回的药品",
  "Pantau stok rendah dan batch mendekati kadaluarsa": "监控低库存和临近过期的批次",
  "Pantau FTW, restriction, dan MCU jatuh tempo": "监控 FTW、工作限制和到期 MCU",
  "Kelola pengajuan waiver HSE": "管理 HSE 豁免申请",
  "Unduh laporan kesehatan kerja": "下载职业健康报表",
  "Lihat siklus MCU pekerja": "查看员工 MCU 周期",
  "Pekerja yang MCU-nya harus dijadwalkan": "需要安排 MCU 的员工",
  "Cari pekerja dan kelola dokumen": "查找员工并管理文件",
  "Jadwalkan siklus pemeriksaan pekerja": "安排员工检查周期",
  "Ekspor rekap untuk manajemen": "导出管理层汇总",
  "Fitness to Work & hasil MCU terakhir": "Fitness to Work 和最近 MCU 结果",
  "Unduh sertifikat kesehatan kerja": "下载职业健康证书",
  "Pengingat MCU dan surat": "MCU 提醒和信函",
  "Periksa data pribadi & kontak": "检查个人资料和联系方式",
  "Catat hasil laboratorium & radiologi": "记录化验和放射结果",
  "Catat hasil Drug & Alcohol": "记录药物与酒精检测结果",
  "Status kepatuhan FTW & restriction": "FTW 和工作限制合规状态",
  "Kelola akun dan peran": "管理账户和角色",
  "Site, unit, job task, katalog ICD-10": "场地、单位、工作任务、ICD-10 目录",
  "Pendaftaran pekerja dan consent digital": "员工登记和数字同意",
  "Telusuri aktivitas sistem": "追踪系统活动",
  "Pantau FTW seluruh site": "监控所有场地的 FTW",
  "Rekap MCU, FTW, dan kunjungan": "MCU、FTW 和就诊汇总",
  "Distribusi Fitness to Work": "Fitness to Work 分布",
  "Siklus MCU pekerja seluruh site": "所有场地的员工 MCU 周期",

  // 数字卡片
  "Total pekerja": "员工总数",
  "MCU menunggu dokter": "等待医生的 MCU",
  "MCU jatuh tempo ≤ 30 hari": "30 天内到期的 MCU",
  "Kunjungan hari ini": "今日就诊",
  "Antrean menunggu": "候诊人数",
  "Sertifikat valid": "有效证书",
  "Fit to Work": "适合工作",
  "Fit with Restriction": "有限制地适合工作",
  "Memiliki restriction": "有工作限制",
  "Stok rendah": "库存不足",
  "Resep menunggu dispensing": "待发处方",
  "Status FTW saya": "我的 FTW 状态",
  "Berlaku sampai": "有效期至",
  "MCU saya menunggu": "我的待处理 MCU",
  "Order lab menunggu": "待处理化验单",
  "Hasil lab tersedia": "可用化验结果",

  // 界面文本
  "Halo,": "你好，",
  "Muat ulang": "重新加载",
  notifikasi: "条通知",
  "Tindakan cepat": "快捷操作",
  "Sebagian ringkasan gagal dimuat dari backend": "部分汇总无法从后端加载",
  "Coba lagi": "重试",
  "Ruang saya": "我的空间",
  "MCU terbaru": "最新 MCU",
  "Belum ada data MCU.": "暂无 MCU 数据。",
  "Kunjungan berjalan": "进行中的就诊",
  "Tidak ada kunjungan berjalan.": "没有进行中的就诊。",
  "Tidak diketahui": "未知",
};

const PHRASES: Record<Exclude<Language, "id">, Record<string, string>> = {
  en: EN,
  zh: ZH,
};

/** Daftar frasa Indonesia yang sudah diterjemahkan — dipakai tes kelengkapan. */
export function dashboardPhraseKeys(language: Exclude<Language, "id">): string[] {
  return Object.keys(PHRASES[language]);
}

export function translateDashboardPhrase(language: Language, text: string): string {
  if (language === "id") return text;
  return PHRASES[language][text] ?? text;
}
