import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 1) Supabase Dashboard'da gördüğünüz API URL / Project URL değerini buraya yazın.
// Örnek: "https://nmwilorpndsnzwqhruky.supabase.co"
const SUPABASE_URL = "https://nmwilorpndsnzwqhruky.supabase.co";

// 2) Supabase Dashboard'dan aldığınız Publishable key değerini buraya yazın.
// Secret key veya service_role key kullanmayın.
const SUPABASE_PUBLISHABLE_KEY = "BURAYA_SUPABASE_PUBLISHABLE_KEY";

const SHOW_SLOTS_BUTTON_TEXT = "Oturum listesini göster";
const SAVE_BUTTON_TEXT = "Seçili oturumu kaydet";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const codeInput = document.querySelector("#codeInput");
const showSlotsButton = document.querySelector("#showSlotsButton");
const codeMessage = document.querySelector("#codeMessage");
const infoMessage = document.querySelector("#infoMessage");
const slotsContainer = document.querySelector("#slotsContainer");
const saveButton = document.querySelector("#saveButton");
const saveMessage = document.querySelector("#saveMessage");

let currentCode = "";
let selectedSlotId = null;
let lastLoadedSlots = [];

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("BURAYA_") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes("BURAYA_")
  );
}

function setButtonLoading(button, isLoading, loadingText, normalText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : normalText;
}

function setCodeError(message) {
  codeMessage.textContent = message;
  codeMessage.className = "message error-message";
}

function clearCodeMessage() {
  codeMessage.textContent = "";
  codeMessage.className = "message";
}

function setInfo(message) {
  infoMessage.textContent = message;
  infoMessage.className = "message info-message";
}

function setSaveError(message) {
  saveMessage.textContent = message;
  saveMessage.className = "message error-message";
}

function setSaveSuccess(message) {
  saveMessage.textContent = message;
  saveMessage.className = "message success-message";
}

function clearSaveMessage() {
  saveMessage.textContent = "";
  saveMessage.className = "message";
}

function capitalizeTurkish(value) {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
}

function formatSessionDate(isoString) {
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

function renderSlots(slots) {
  slotsContainer.innerHTML = "";
  lastLoadedSlots = Array.isArray(slots) ? slots : [];

  if (lastLoadedSlots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Şu anda seçilebilir müsait oturum bulunmuyor.";
    slotsContainer.appendChild(empty);
    return;
  }

  lastLoadedSlots.forEach((slot) => {
    const slotButton = document.createElement("button");
    slotButton.type = "button";
    slotButton.className = "slot-card";
    slotButton.dataset.slotId = String(slot.id);

    const title = document.createElement("span");
    title.className = "slot-card-title";
    title.textContent = formatSessionDate(slot.starts_at);

    const meta = document.createElement("span");
    meta.className = "slot-card-meta";
    meta.textContent = `${slot.total_selected ?? 0}/16 kişi seçti`;

    slotButton.appendChild(title);
    slotButton.appendChild(meta);

    if (slot.is_selected || Number(slot.id) === Number(selectedSlotId)) {
      slotButton.classList.add("selected");
      selectedSlotId = Number(slot.id);
    }

    slotButton.addEventListener("click", () => {
      document.querySelectorAll(".slot-card").forEach((item) => {
        item.classList.remove("selected");
      });

      selectedSlotId = Number(slot.id);
      slotButton.classList.add("selected");
      clearSaveMessage();
    });

    slotsContainer.appendChild(slotButton);
  });
}

async function loadOptions() {
  clearCodeMessage();
  clearSaveMessage();

  const enteredCode = codeInput.value.trim();

  if (!enteredCode) {
    setCodeError("Lütfen kullanıcı kodunuzu giriniz.");
    return;
  }

  if (!isSupabaseConfigured()) {
    setCodeError("app.js dosyasında Supabase URL ve Publishable key değerlerini girmeniz gerekiyor.");
    return;
  }

  currentCode = enteredCode;
  selectedSlotId = null;
  saveButton.disabled = true;
  slotsContainer.innerHTML = "";
  setInfo("Oturum listesi yükleniyor...");
  setButtonLoading(showSlotsButton, true, "Yükleniyor...", SHOW_SLOTS_BUTTON_TEXT);

  try {
    const { data, error } = await supabase.rpc("app_get_options", {
      p_code: currentCode
    });

    if (error) {
      console.error(error);
      setInfo("Kullanıcı kodunuzu girdikten sonra oturum listesi burada görünecektir.");
      setCodeError("Oturum listesi alınırken hata oluştu. Lütfen tekrar deneyiniz.");
      return;
    }

    if (!data?.ok) {
      setInfo("Kullanıcı kodunuzu girdikten sonra oturum listesi burada görünecektir.");
      setCodeError(data?.message || "Kullanıcı kodu hatalı");
      return;
    }

    if (data.selected_starts_at) {
      selectedSlotId = Number(data.selected_slot_id);
      setInfo(`Seçim yaptığınız oturum: ${formatSessionDate(data.selected_starts_at)}`);
    } else {
      setInfo("Henüz oturum seçimi yapmadınız");
    }

    renderSlots(data.slots || []);
    saveButton.disabled = false;
  } finally {
    setButtonLoading(showSlotsButton, false, "Yükleniyor...", SHOW_SLOTS_BUTTON_TEXT);
  }
}

async function saveSelection() {
  clearSaveMessage();

  if (!currentCode) {
    setSaveError("Önce kullanıcı kodunuzu girip oturum listesini gösteriniz.");
    return;
  }

  if (!selectedSlotId) {
    setSaveError("Lütfen listeden bir oturum seçiniz.");
    return;
  }

  if (!isSupabaseConfigured()) {
    setSaveError("app.js dosyasında Supabase URL ve Publishable key değerlerini girmeniz gerekiyor.");
    return;
  }

  setButtonLoading(saveButton, true, "Kaydediliyor...", SAVE_BUTTON_TEXT);

  try {
    const { data, error } = await supabase.rpc("app_select_session", {
      p_code: currentCode,
      p_slot_id: selectedSlotId
    });

    if (error) {
      console.error(error);
      setSaveError("Kayıt sırasında teknik bir hata oluştu. Lütfen tekrar deneyiniz.");
      return;
    }

    if (!data?.ok) {
      setSaveError(data?.message || "Seçiminiz kaydedilemedi.");
      return;
    }

    await loadOptions();
    setSaveSuccess("Seçiminiz kaydedildi.");
  } finally {
    setButtonLoading(saveButton, false, "Kaydediliyor...", SAVE_BUTTON_TEXT);
  }
}

showSlotsButton.addEventListener("click", loadOptions);
saveButton.addEventListener("click", saveSelection);

codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadOptions();
  }
});

codeInput.addEventListener("input", () => {
  clearCodeMessage();

  if (currentCode && codeInput.value.trim() !== currentCode) {
    saveButton.disabled = true;
    selectedSlotId = null;
    slotsContainer.innerHTML = "";
    setInfo("Kullanıcı kodunuzu girdikten sonra oturum listesi burada görünecektir.");
    clearSaveMessage();
  }
});

if (!isSupabaseConfigured()) {
  setCodeError("Yayınlamadan önce app.js dosyasında Supabase URL ve Publishable key değerlerini girin.");
}
