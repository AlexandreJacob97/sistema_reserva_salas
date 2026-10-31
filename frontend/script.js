const form = document.querySelector(".login-form");
const fields = [
  {
    input: document.querySelector("#email"),
    error: document.querySelector("#email-error"),
  },
  {
    input: document.querySelector("#password"),
    error: document.querySelector("#password-error"),
  },
];

function validateField(field) {
  const isEmpty = field.input.value.trim() === "";

  field.input.setAttribute("aria-invalid", String(isEmpty));
  field.error.textContent = isEmpty ? "Campo obrigatório." : "";

  return !isEmpty;
}

fields.forEach((field) => {
  field.input.addEventListener("input", () => {
    if (field.input.value.trim() !== "") {
      validateField(field);
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const isValid = fields.map(validateField).every(Boolean);
  const firstInvalidField = fields.find(
    (field) => field.input.getAttribute("aria-invalid") === "true",
  );

  if (!isValid) {
    firstInvalidField.input.focus();
  }
});
