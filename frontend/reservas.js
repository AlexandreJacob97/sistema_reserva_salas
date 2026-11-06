const roomList = document.querySelector("#room-list");
const roomSelect = document.querySelector("#room-id");
const reservationList = document.querySelector("#reservation-list");
const reservationForm = document.querySelector("#reservation-form");
const formFeedback = document.querySelector("#form-feedback");
const studentCountInput = document.querySelector("#student-count");
const capacityFeedback = document.querySelector("#capacity-feedback");

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

async function request(path, options) {
  const response = await fetch(`/api/${path}`, options);
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(
      payload.error || "Não foi possível concluir a solicitação.",
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

function renderRooms(rooms) {
  roomList.replaceChildren();
  roomSelect.replaceChildren(new Option("Selecione uma sala", ""));
  document.querySelector("#rooms-count").textContent =
    `${rooms.length} ${rooms.length === 1 ? "sala" : "salas"}`;

  for (const room of rooms) {
    const card = createElement("article", "room-card");
    card.dataset.capacity = String(room.capacity);
    const roomName = createElement("h3", "", room.name);
    const header = createElement("div", "room-card-header");
    header.append(roomName);
    const details = createElement(
      "p",
      "room-details",
      `${room.floor} · Capacidade para ${room.capacity} pessoas`,
    );
    const resourceList = createElement("ul", "resource-list");

    for (const resource of room.resources) {
      resourceList.append(createElement("li", "", resource));
    }

    card.append(header, details, resourceList);
    roomList.append(card);
    const label = `${room.name} — ${room.floor}`;
    const option = new Option(label, String(room.id));
    option.dataset.label = label;
    option.dataset.capacity = String(room.capacity);
    roomSelect.add(option);
  }

  updateRoomAvailability();
}

function updateRoomAvailability() {
  const studentCount = Number(studentCountInput.value);
  const hasValidCount =
    studentCountInput.value !== "" &&
    Number.isSafeInteger(studentCount) &&
    studentCount > 0;
  let availableRooms = 0;

  for (const option of roomSelect.options) {
    if (!option.value) continue;

    const isCompatible =
      hasValidCount && Number(option.dataset.capacity) >= studentCount;
    if (isCompatible) availableRooms += 1;
    option.textContent = hasValidCount && !isCompatible
      ? `${option.dataset.label} — capacidade insuficiente`
      : option.dataset.label;
  }

  for (const card of roomList.querySelectorAll(".room-card")) {
    const isCompatible =
      hasValidCount && Number(card.dataset.capacity) >= studentCount;
    card.classList.toggle("room-card-compatible", isCompatible);
    card.classList.toggle(
      "room-card-incompatible",
      hasValidCount && !isCompatible,
    );

    let badge = card.querySelector(".room-capacity-badge");
    if (!hasValidCount) {
      badge?.remove();
      continue;
    }

    if (!badge) {
      badge = createElement("span", "room-capacity-badge");
      card.querySelector(".room-card-header").append(badge);
    }
    badge.className = `room-capacity-badge ${
      isCompatible ? "room-capacity-badge-compatible" : "room-capacity-badge-incompatible"
    }`;
    badge.textContent = isCompatible
      ? "Comporta a turma"
      : "Capacidade insuficiente";
  }

  const selectedRoomIsIncompatible =
    hasValidCount &&
    roomSelect.value !== "" &&
    Number(roomSelect.selectedOptions[0].dataset.capacity) < studentCount;
  const selectionMessage = selectedRoomIsIncompatible
    ? " A sala selecionada não comporta essa turma."
    : "";

  if (!hasValidCount) {
    capacityFeedback.textContent =
      "Informe a quantidade de alunos para ver as salas compatíveis.";
  } else if (availableRooms === 0) {
    capacityFeedback.textContent =
      `Nenhuma das ${roomSelect.options.length - 1} salas comporta ${studentCount} alunos.${selectionMessage}`;
  } else if (availableRooms === 1) {
    capacityFeedback.textContent =
      `1 sala, de ${roomSelect.options.length - 1}, tem capacidade para ${studentCount} alunos.${selectionMessage}`;
  } else {
    capacityFeedback.textContent =
      `${availableRooms} de ${roomSelect.options.length - 1} salas comportam ${studentCount} alunos.${selectionMessage}`;
  }
}

function renderReservations(reservations) {
  reservationList.replaceChildren();
  document.querySelector("#reservations-count").textContent =
    `${reservations.length} ${reservations.length === 1 ? "solicitação" : "solicitações"}`;

  if (reservations.length === 0) {
    reservationList.append(
      createElement("p", "empty-state", "Ainda não há solicitações de reserva."),
    );
    return;
  }

  for (const reservation of reservations) {
    const card = createElement("article", "reservation-card");
    const top = createElement("div", "reservation-card-top");
    const title = createElement("h3", "", reservation.roomName);
    const status = createElement(
      "span",
      `status-badge status-${reservation.status}`,
      reservation.status,
    );
    const schedule = createElement(
      "p",
      "reservation-schedule",
      `${formatDate(reservation.date)} · ${reservation.startTime}–${reservation.endTime}`,
    );
    const responsible = createElement(
      "p",
      "reservation-detail",
      `Responsável: ${reservation.responsibleName}`,
    );
    const purpose = createElement("p", "reservation-purpose", reservation.purpose);
    const floor = createElement("span", "reservation-floor", reservation.roomFloor);

    top.append(title, status);
    card.append(top, schedule, responsible, purpose, floor);
    reservationList.append(card);
  }
}

function getLocalDate() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

document.querySelector("#requested-date").min = getLocalDate();
studentCountInput.addEventListener("input", updateRoomAvailability);
roomSelect.addEventListener("change", updateRoomAvailability);

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formFeedback.textContent = "";

  const submitButton = reservationForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  formFeedback.classList.remove("is-error");
  formFeedback.setAttribute("role", "status");

  try {
    const formData = new FormData(reservationForm);
    await request("reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: Number(formData.get("roomId")),
        studentCount: Number(formData.get("studentCount")),
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        responsibleName: formData.get("responsibleName"),
        purpose: formData.get("purpose"),
      }),
    });

    reservationForm.reset();
    updateRoomAvailability();
    document.querySelector("#requested-date").min = getLocalDate();
    formFeedback.textContent = "Solicitação enviada. Situação: pendente.";
    try {
      renderReservations(await request("reservations"));
    } catch (error) {
      console.error("Reservation was created but the list could not be refreshed.", error);
      formFeedback.textContent =
        "Solicitação criada, mas não foi possível atualizar a lista.";
    }
  } catch (error) {
    formFeedback.textContent = error.message;
    formFeedback.classList.add("is-error");
    const isConflict = error.status === 409;
    formFeedback.setAttribute("role", isConflict ? "alert" : "status");
    formFeedback.setAttribute("aria-live", isConflict ? "assertive" : "polite");
  } finally {
    submitButton.disabled = false;
  }
});

async function loadReservationPage() {
  try {
    const [rooms, reservations] = await Promise.all([
      request("rooms"),
      request("reservations"),
    ]);

    renderRooms(rooms);
    renderReservations(reservations);
  } catch (error) {
    roomList.replaceChildren(
      createElement("p", "page-error", `Não foi possível carregar as salas: ${error.message}`),
    );
    reservationList.replaceChildren(
      createElement(
        "p",
        "page-error",
        "Não foi possível carregar as solicitações. Verifique se a API está em execução.",
      ),
    );
  }
}

loadReservationPage();
