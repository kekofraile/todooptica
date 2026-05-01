const prefersReducedMotion =
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TodoOpticaUi = window.TodoOptica || {};
const centers = TodoOpticaUi.centers || {};

const parseDateParts = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }
  match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (match) {
    return {
      day: Number(match[1]),
      month: Number(match[2]),
      year: Number(match[3]),
    };
  }
  match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (match) {
    return {
      day: Number(match[1]),
      month: Number(match[2]),
      year: Number(match[3]),
    };
  }
  return null;
};

const normalizeDate = (value) => {
  const parts = parseDateParts(value);
  if (!parts) return "";
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
};

const formatDateES = (value) => {
  if (!value) return "";
  const parts = parseDateParts(value);
  if (!parts) return String(value);
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(
    2,
    "0",
  )}/${parts.year}`;
};

const getDayFromInput = (value) => {
  const parts = parseDateParts(value);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

const buildContactByCenter = () =>
  Object.fromEntries(
    Object.entries(centers).map(([key, center]) => {
      const message = TodoOpticaUi.buildWhatsAppMessage?.({
        center: center.label,
      });
      return [
        key,
        {
          label: center.label,
          telHref: `tel:${center.phone}`,
          whatsapp: TodoOpticaUi.buildWhatsAppUrl?.(message || "") || "#",
          maps: center.maps,
        },
      ];
    }),
  );

const getAppointmentConfigForDate = (centerKey, value) => {
  const normalizedDate = normalizeDate(value);
  const year = normalizedDate
    ? Number(normalizedDate.slice(0, 4))
    : new Date().getFullYear();
  return TodoOpticaUi.getAppointmentConfig?.(centerKey, year) || null;
};

const buildTimeSlots = (rule) => {
  if (!rule) return [];
  const [startHour, startMinute] = rule.start.split(":").map(Number);
  const [endHour, endMinute] = rule.end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const slots = [];

  for (
    let total = startTotal;
    total <= endTotal;
    total += rule.intervalMinutes || 30
  ) {
    const hour = String(Math.floor(total / 60)).padStart(2, "0");
    const minute = String(total % 60).padStart(2, "0");
    slots.push(`${hour}:${minute}`);
  }

  return slots;
};

const fillTimeSelect = (select, options, placeholder) => {
  if (!select) return;
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);

  options.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    select.appendChild(option);
  });
};

const setupCenterPicker = () => {
  const roots = document.querySelectorAll("[data-center-picker]");
  if (!roots.length) return;

  roots.forEach((root) => {
    const options = Array.from(root.querySelectorAll(".center-option"));
    const inputs = Array.from(root.querySelectorAll('input[name="location"]'));
    if (!inputs.length || !options.length) return;

    const sync = () => {
      options.forEach((option) => {
        const input = option.querySelector('input[name="location"]');
        option.classList.toggle("is-selected", Boolean(input?.checked));
      });
    };

    inputs.forEach((input) => {
      input.addEventListener("change", sync);
    });

    sync();
  });
};

const setupAppointmentWizard = () => {
  const root = document.querySelector(".immersive-wizard");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".wizard-slide"));
  const progressFill = root.querySelector("[data-wizard-progress]");
  const indicatorsContainer = root.querySelector("[data-wizard-indicators]");
  const form = document.getElementById("appointment-form");
  if (!form) return;

  const totalSlides = slides.length;
  const contactByCenter = buildContactByCenter();
  const scheduleNote = root.querySelector("[data-schedule-note]");
  const dateInput = root.querySelector('input[name="date"]');
  const timeSelect = root.querySelector('select[name="time"]');
  const asideText = document.querySelector("[data-aside-center]");
  const asideActions = document.querySelector("[data-aside-actions]");
  const asideWhatsApp = document.querySelector("[data-aside-whatsapp]");
  const asideMaps = document.querySelector("[data-aside-maps]");
  const fallbackCall = document.querySelector("[data-fallback-call]");
  const fallbackWhatsApp = document.querySelector("[data-fallback-wa]");
  const centerInputs = Array.from(root.querySelectorAll('input[name="location"]'));
  const serviceInputs = Array.from(root.querySelectorAll('input[name="service"]'));
  let currentSlide = 0;
  let flatpickrInstance = null;
  let lastConstraintsKey = "";

  const getSelectedCenter = () =>
    centerInputs.find((input) => input.checked)?.value || "";

  const getSelectedService = () =>
    serviceInputs.find((input) => input.checked)?.value || "";

  const setNote = (text) => {
    if (scheduleNote) scheduleNote.textContent = text;
  };

  const updateProgress = (index) => {
    const pct = ((index + 1) / totalSlides) * 100;
    if (progressFill) progressFill.style.width = `${pct}%`;
    const indicators = indicatorsContainer?.querySelectorAll("span") || [];
    indicators.forEach((span, idx) => {
      span.style.opacity = idx === index ? "1" : "0.4";
    });
  };

  const goToSlide = (index) => {
    if (index < 0 || index >= totalSlides) return;
    currentSlide = index;
    slides.forEach((slide, idx) => {
      slide.classList.remove("active", "prev");
      if (idx === currentSlide) slide.classList.add("active");
      else if (idx < currentSlide) slide.classList.add("prev");
    });
    updateProgress(currentSlide);
  };

  const updateAside = (location, messageUrl) => {
    if (!asideText || !asideActions || !asideWhatsApp || !asideMaps) return;
    const data = contactByCenter[location];
    if (!data) {
      asideText.textContent =
        "Selecciona un centro para ver WhatsApp directo y cómo llegar.";
      asideActions.hidden = true;
      return;
    }
    asideText.textContent = `Contacto directo: ${data.label}.`;
    asideActions.hidden = false;
    asideWhatsApp.href = messageUrl || data.whatsapp;
    asideMaps.href = data.maps;
  };

  const updateFallback = (location, messageUrl) => {
    const data = contactByCenter[location];
    if (!data) return;
    if (fallbackCall) fallbackCall.href = data.telHref;
    if (fallbackWhatsApp) fallbackWhatsApp.href = messageUrl || data.whatsapp;
  };

  const updateTimeConstraints = (location, value) => {
    if (!dateInput || !timeSelect) return;

    const config = getAppointmentConfigForDate(location, value);
    const normalizedDate = normalizeDate(value);
    const day = getDayFromInput(value);
    const isHoliday =
      Boolean(location && normalizedDate) &&
      TodoOpticaUi.isAppointmentHoliday?.(location, normalizedDate) === true;

    dateInput.setCustomValidity("");

    if (!location || !config) {
      setNote("Selecciona centro y fecha para ver horarios disponibles.");
      fillTimeSelect(timeSelect, [], "Selecciona centro primero");
      return;
    }

    if (!value || day === null) {
      setNote(config.profile.defaultNote);
      fillTimeSelect(timeSelect, [], "Selecciona fecha primero");
      return;
    }

    if (config.profile.closedWeekdays.includes(day)) {
      dateInput.setCustomValidity("Centro cerrado en esa fecha. Elige otra.");
      setNote(
        day === 0
          ? "Domingo: centro cerrado. Elige otra fecha."
          : "Centro cerrado ese día. Elige otra fecha.",
      );
      fillTimeSelect(timeSelect, [], `${day === 0 ? "Domingo" : "Día"} no disponible`);
      return;
    }

    if (isHoliday) {
      dateInput.setCustomValidity("Festivo en este centro. Elige otra fecha.");
      setNote(`${config.profile.label}: festivo. Elige otra fecha.`);
      fillTimeSelect(timeSelect, [], "Festivo no disponible");
      return;
    }

    const rule =
      day === 6 ? config.profile.rules.saturday : config.profile.rules.weekday;

    if (!rule) {
      dateInput.setCustomValidity("Centro cerrado en esa fecha. Elige otra.");
      setNote("Centro cerrado ese día. Elige otra fecha.");
      fillTimeSelect(timeSelect, [], "Horario no disponible");
      return;
    }

    setNote(`Horario ${config.profile.label}: ${rule.label}.`);
    fillTimeSelect(timeSelect, buildTimeSlots(rule), `Selecciona hora (${rule.label})`);
  };

  const updateSummary = () => {
    const formData = new FormData(form);
    const location = getSelectedCenter();
    const service = getSelectedService() || formData.get("service");
    const dateValue = dateInput?.value || formData.get("date");
    const timeValue = timeSelect?.value || formData.get("time");

    const setText = (selector, text) => {
      const node = root.querySelector(selector);
      if (node) node.textContent = text || "—";
    };

    setText(
      "[data-summary-location]",
      centers[location]?.appointmentLabel || centers[location]?.label || location,
    );
    setText("[data-summary-service]", service);
    setText("[data-summary-date]", formatDateES(dateValue));
    setText("[data-summary-time]", timeValue);

    const message = TodoOpticaUi.buildWhatsAppMessage?.({
      center: centers[location]?.label,
      service,
      date: formatDateES(dateValue),
      time: timeValue,
      note: formData.get("message"),
    });
    const messageUrl = TodoOpticaUi.buildWhatsAppUrl?.(message || "") || "#";

    updateAside(location, messageUrl);
    updateFallback(location, messageUrl);

    if (TodoOpticaUi.setStickyContext) {
      TodoOpticaUi.setStickyContext({
        center: location,
        service,
        date: formatDateES(dateValue),
        time: timeValue,
      });
    }

    const constraintsKey = `${location}|${normalizeDate(dateValue)}`;
    if (constraintsKey !== lastConstraintsKey) {
      updateTimeConstraints(location, dateValue);
      lastConstraintsKey = constraintsKey;
    }
  };

  const initFlatpickr = (location) => {
    if (!dateInput || typeof flatpickr === "undefined") return;
    if (!location || !centers[location]) {
      flatpickrInstance?.destroy();
      flatpickrInstance = null;
      return;
    }

    flatpickrInstance?.destroy();
    flatpickrInstance = flatpickr(dateInput, {
      locale: "es",
      dateFormat: "Y-m-d",
      minDate: "today",
      disable: [
        (candidate) => {
          const config = getAppointmentConfigForDate(location, candidate);
          if (!config) return false;
          const day = candidate.getDay();
          if (config.profile.closedWeekdays.includes(day)) return true;
          return TodoOpticaUi.isAppointmentHoliday?.(location, candidate) === true;
        },
      ],
      onChange: (_selectedDates, dateStr) => {
        if (dateStr) dateInput.value = dateStr;
        updateSummary();
      },
      onDayCreate: (_dObj, _dStr, _fp, dayElem) => {
        if (!location || !dayElem.dateObj) return;
        const day = dayElem.dateObj.getDay();
        const isClosedDay =
          getAppointmentConfigForDate(location, dayElem.dateObj)?.profile.closedWeekdays.includes(day) ||
          false;
        const isHoliday =
          TodoOpticaUi.isAppointmentHoliday?.(location, dayElem.dateObj) === true;
        if (isClosedDay || isHoliday) {
          dayElem.classList.add("flatpickr-disabled-red");
        }
      },
    });
  };

  if (indicatorsContainer) {
    indicatorsContainer.innerHTML = slides
      .map((_, index) => `<span>Paso ${index + 1}</span>`)
      .join("");
  }

  centerInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateSummary();
      initFlatpickr(input.value);
      window.setTimeout(() => goToSlide(1), 350);
    });
  });

  serviceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateSummary();
      window.setTimeout(() => goToSlide(2), 350);
    });
  });

  dateInput?.addEventListener("change", updateSummary);
  dateInput?.addEventListener("input", updateSummary);
  timeSelect?.addEventListener("change", updateSummary);

  root.querySelectorAll("[data-wizard-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const activeSlide = slides[currentSlide];
      const requiredInputs = activeSlide.querySelectorAll(
        "input[required], select[required]",
      );
      let valid = true;

      requiredInputs.forEach((input) => {
        if (!input.checkValidity()) {
          valid = false;
          input.reportValidity();
        }
      });

      if (valid) goToSlide(currentSlide + 1);
    });
  });

  root.querySelectorAll("[data-wizard-prev]").forEach((button) => {
    button.addEventListener("click", () => {
      goToSlide(currentSlide - 1);
    });
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      initFlatpickr("");
      updateSummary();
      goToSlide(0);
    }, 50);
  });

  const params = new URLSearchParams(window.location.search);
  const preselectCenter = params.get("center") || params.get("location");
  const preselectService = params.get("service");

  if (preselectCenter && centers[preselectCenter]) {
    const input = root.querySelector(
      `input[name="location"][value="${preselectCenter}"]`,
    );
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  if (preselectService) {
    const input = root.querySelector(
      `input[name="service"][value="${preselectService}"]`,
    );
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  updateProgress(0);
  updateSummary();
  if (!preselectCenter) initFlatpickr("");
};

setupCenterPicker();
setupAppointmentWizard();

const appointmentForm = document.getElementById("appointment-form");
const formStatus = document.getElementById("form-status");

const setStatus = (type, message) => {
  if (!formStatus) return;
  formStatus.textContent = message || "";
  formStatus.dataset.state = type || "";
};

if (appointmentForm) {
  appointmentForm.addEventListener("reset", () => {
    setStatus("", "");
  });

  appointmentForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!appointmentForm.checkValidity()) {
      appointmentForm.reportValidity();
      setStatus("error", "Revisa los campos obligatorios antes de abrir WhatsApp.");
      return;
    }

    const formData = new FormData(appointmentForm);
    const location = formData.get("location");
    const service = formData.get("service");
    const dateValue = formData.get("date");
    const timeValue = formData.get("time");
    const note = formData.get("message");

    const message = TodoOpticaUi.buildWhatsAppMessage?.({
      center: centers[location]?.label,
      service,
      date: formatDateES(dateValue),
      time: timeValue,
      note,
    });
    const whatsappUrl = TodoOpticaUi.buildWhatsAppUrl?.(message || "") || "#";

    setStatus("success", "Abriendo WhatsApp con tu solicitud...");

    const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(whatsappUrl);
    }
  });
}
