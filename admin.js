import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Supabase API URL / Project URL değerini buraya yazın.
// Dikkat: URL sonunda /rest/v1 OLMAMALI.
const SUPABASE_URL = "https://nmwilorpndsnzwqhruky.supabase.co";

// 2) Supabase Dashboard'dan aldığınız Publishable key değerini buraya yazın.
// Secret key veya service_role key kullanmayın.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6e90naaunXrbVTlgmcm1iw_3eTTebiL";

const ADMIN_CODE_STORAGE_KEY = "oturum_secim_admin_code";
const ADMIN_CODE_PATTERN = /^[A-Z0-9]{6}$/;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const adminCodeInput = document.querySelector("#adminCodeInput");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");
const dashboardMessage = document.querySelector("#dashboardMessage");
const refreshButton = document.querySelector("#refreshButton");
const exportButton = document.querySelector("#exportButton");
const logoutButton = document.querySelector("#logoutButton");
const lastUpdatedText = document.querySelector("#lastUpdatedText");
const totalParticipants = document.querySelector("#totalParticipants");
const selectedParticipants = document.querySelector("#selectedParticipants");
const unselectedParticipants = document.querySelector("#unselectedParticipants");
const totalSlots = document.querySelector("#totalSlots");
const slotsGrid = document.querySelector("#slotsGrid");

let currentAdminCode = sessionStorage.getItem(ADMIN_CODE_STORAGE_KEY) || "";

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("BURAYA_") &&
    !SUPABASE_URL.includes("/rest/v1") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes("BURAYA_")
  );
}

function sanitizeAdminCode(value) {
  return String(value || "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function setMessage(element, message, type = "") {
  element.textContent = message || "";
  element.className = type ? `message ${type}` : "message";
}

function clearMessages() {
  setMessage(loginMessage, "");
  setMessage(dashboardMessage, "");
}

function setButtonLoading(button, isLoading, loadingText, normalText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : normalText;
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
}

function showLogin() {
  dashboardView.classList.add("hidden");
  loginView.classList.remove("hidden");
  adminCodeInput.focus();
}

function capitalizeTurkish(value) {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
}

function formatDateTime(isoString) {
  if (!isoString) return "";

  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const day = parts.day;
  const month = capitalizeTurkish(parts.month);
  const year = parts.year;
  const weekday = capitalizeTurkish(parts.weekday);
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const minute = parts.minute;

  return `${day} ${month} ${year} ${weekday}, ${hour}:${minute}`;
}

function formatNow() {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
}

function getSlotStatusClass(count) {
  if (count >= 16) return "full";
  if (count >= 12) return "high";
  if (count >= 8) return "medium";
  if (count > 0) return "low";
  return "empty";
}

function getSlotStatusText(count) {
  if (count >= 16) return "Dolu";
  if (count >= 12) return "Dolmak üzere";
  if (count >= 8) return "Orta doluluk";
  if (count > 0) return "Müsait";
  return "Boş";
}

function renderSummary(summary = {}) {
  totalParticipants.textContent = summary.total_participants ?? 0;
  selectedParticipants.textContent = summary.selected_participants ?? 0;
  unselectedParticipants.textContent = summary.unselected_participants ?? 0;
  totalSlots.textContent = summary.total_slots ?? 0;
}

function renderSlots(slots = []) {
  slotsGrid.innerHTML = "";

  if (!Array.isArray(slots) || slots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Gösterilecek slot bulunamadı.";
    slotsGrid.appendChild(empty);
    return;
  }

  slots.forEach((slot) => {
    const count = Number(slot.total_selected || 0);
    const percent = Math.min(100, Math.round((count / 16) * 100));

    const card = document.createElement("article");
    card.className = `admin-slot-card ${getSlotStatusClass(count)}`;

    const date = document.createElement("span");
    date.className = "slot-date";
    date.textContent = formatDateTime(slot.starts_at);

    const countRow = document.createElement("div");
    countRow.className = "slot-count-row";

    const countText = document.createElement("span");
    countText.className = "slot-count";
    countText.textContent = `${count}/16`;

    const status = document.createElement("span");
    status.className = "slot-status";
    status.textContent = slot.is_active === false ? "Pasif" : getSlotStatusText(count);

    countRow.appendChild(countText);
    countRow.appendChild(status);

    const progress = document.createElement("div");
    progress.className = "slot-progress";

    const progressBar = document.createElement("div");
    progressBar.className = "slot-progress-bar";
    progressBar.style.width = `${percent}%`;

    progress.appendChild(progressBar);

    card.appendChild(date);
    card.appendChild(countRow);
    card.appendChild(progress);

    slotsGrid.appendChild(card);
  });
}

function renderDashboard(data) {
  renderSummary(data.summary || {});
  renderSlots(data.slots || []);
  lastUpdatedText.textContent = `Son güncelleme: ${formatNow()}`;
}

async function loadDashboard(adminCode, options = {}) {
  const { fromLogin = false } = options;

  clearMessages();

  if (!isSupabaseConfigured()) {
    const message = "admin.js dosyasında Supabase URL ve Publishable key değerlerini kontrol edin.";
    if (fromLogin) setMessage(loginMessage, message, "error");
    else setMessage(dashboardMessage, message, "error");
    return false;
  }

  if (!ADMIN_CODE_PATTERN.test(adminCode)) {
    setMessage(loginMessage, "Admin kodu 6 haneli alfanumerik olmalıdır.", "error");
    return false;
  }

  if (fromLogin) {
    setButtonLoading(loginButton, true, "Kontrol ediliyor...", "Giriş yap");
  } else {
    setButtonLoading(refreshButton, true, "Yenileniyor...", "Yenile");
  }

  try {
    const { data, error } = await supabase.rpc("admin_get_dashboard", {
      p_admin_code: adminCode
    });

    if (error) {
      console.error(error);
      const message = "Admin paneli bilgileri alınırken hata oluştu.";
      if (fromLogin) setMessage(loginMessage, message, "error");
      else setMessage(dashboardMessage, message, "error");
      return false;
    }

    if (!data?.ok) {
      const message = data?.message || "Admin kodu hatalı.";
      if (fromLogin) setMessage(loginMessage, message, "error");
      else setMessage(dashboardMessage, message, "error");
      return false;
    }

    currentAdminCode = adminCode;
    sessionStorage.setItem(ADMIN_CODE_STORAGE_KEY, currentAdminCode);
    renderDashboard(data);
    showDashboard();
    setMessage(dashboardMessage, "Admin paneli güncellendi.", "success");
    return true;
  } finally {
    if (fromLogin) {
      setButtonLoading(loginButton, false, "Kontrol ediliyor...", "Giriş yap");
    } else {
      setButtonLoading(refreshButton, false, "Yenileniyor...", "Yenile");
    }
  }
}

function makeExportFilename(extension) {
  const now = new Date();
  const stamp = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .formatToParts(now)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return `oturum-secimleri-${stamp.year}${stamp.month}${stamp.day}-${stamp.hour}${stamp.minute}.${extension}`;
}

function downloadCsv(rows) {
  const headers = [
    "Sıra",
    "Kullanıcı Kodu",
    "Departman",
    "Seçim Durumu",
    "Seçilen Oturum",
    "Seçim Zamanı"
  ];

  const escapeCell = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(escapeCell).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  });

  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = makeExportFilename("csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadExcel(rows) {
  if (!window.XLSX) {
    downloadCsv(rows);
    return;
  }

  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 36 },
    { wch: 28 }
  ];

  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Oturum Secimleri");
  window.XLSX.writeFile(workbook, makeExportFilename("xlsx"));
}

async function exportSelections() {
  clearMessages();

  if (!currentAdminCode || !ADMIN_CODE_PATTERN.test(currentAdminCode)) {
    setMessage(dashboardMessage, "Excel'e aktarmak için önce admin kodu ile giriş yapınız.", "error");
    showLogin();
    return;
  }

  setButtonLoading(exportButton, true, "Hazırlanıyor...", "Excel'e aktar");

  try {
    const { data, error } = await supabase.rpc("admin_get_export", {
      p_admin_code: currentAdminCode
    });

    if (error) {
      console.error(error);
      setMessage(dashboardMessage, "Excel dosyası hazırlanırken hata oluştu.", "error");
      return;
    }

    if (!data?.ok) {
      setMessage(dashboardMessage, data?.message || "Admin kodu hatalı.", "error");
      return;
    }

    const rows = Array.isArray(data.rows) ? data.rows : [];
    const exportRows = rows.map((row, index) => ({
      "Sıra": index + 1,
      "Kullanıcı Kodu": row.access_code || "",
      "Departman": row.department_no ?? "",
      "Seçim Durumu": row.status || (row.starts_at ? "Seçim yaptı" : "Seçim yapmadı"),
      "Seçilen Oturum": row.starts_at ? formatDateTime(row.starts_at) : "",
      "Seçim Zamanı": row.selected_at ? formatDateTime(row.selected_at) : ""
    }));

    downloadExcel(exportRows);
    setMessage(dashboardMessage, "Excel dosyası indirildi.", "success");
  } finally {
    setButtonLoading(exportButton, false, "Hazırlanıyor...", "Excel'e aktar");
  }
}

function logout() {
  currentAdminCode = "";
  sessionStorage.removeItem(ADMIN_CODE_STORAGE_KEY);
  adminCodeInput.value = "";
  slotsGrid.innerHTML = "";
  clearMessages();
  showLogin();
}

loginButton.addEventListener("click", () => {
  const code = sanitizeAdminCode(adminCodeInput.value);
  adminCodeInput.value = code;
  loadDashboard(code, { fromLogin: true });
});

adminCodeInput.addEventListener("input", () => {
  adminCodeInput.value = sanitizeAdminCode(adminCodeInput.value);
});

adminCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const code = sanitizeAdminCode(adminCodeInput.value);
    adminCodeInput.value = code;
    loadDashboard(code, { fromLogin: true });
  }
});

refreshButton.addEventListener("click", () => {
  loadDashboard(currentAdminCode, { fromLogin: false });
});

exportButton.addEventListener("click", exportSelections);
logoutButton.addEventListener("click", logout);

if (currentAdminCode && ADMIN_CODE_PATTERN.test(currentAdminCode)) {
  loadDashboard(currentAdminCode, { fromLogin: false });
} else {
  showLogin();
}
