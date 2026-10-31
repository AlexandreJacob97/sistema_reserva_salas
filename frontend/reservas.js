const roomList = document.querySelector("#room-list");
const roomSelect = document.querySelector("#room-id");
const reservationList = document.querySelector("#reservation-list");
const reservationForm = document.querySelector("#reservation-form");
const formFeedback = document.querySelector("#form-feedback");

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
    throw new Error(payload.error || "Não foi possível concluir a solicitação.");
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
    const roomName = createElement("h3", "", room.name);
    const details = createElement(
      "p",
      "room-details",
      `${room.floor} · Capacidade para ${room.capacity} pessoas`,
    );
    const resourceList = createElement("ul", "resource-list");

    for (const resource of room.resources) {
      resourceList.append(createElement("li", "", resource));
    }

    card.append(roomName, details, resourceList);
    roomList.append(card);
    roomSelect.add(new Option(`${room.name} — ${room.floor}`, String(room.id)));
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

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formFeedback.textContent = "";

  const submitButton = reservationForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const formData = new FormData(reservationForm);
    await request("reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: Number(formData.get("roomId")),
        date: formData.get("date"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        responsibleName: formData.get("responsibleName"),
        purpose: formData.get("purpose"),
      }),
    });

    reservationForm.reset();
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
