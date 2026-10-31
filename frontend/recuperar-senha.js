const form = document.querySelector(".login-form");
const email = document.querySelector("#email");
const error = document.querySelector("#email-error");

function validateEmail() {
  const isEmpty = email.value.trim() === "";

  email.setAttribute("aria-invalid", String(isEmpty));
  error.textContent = isEmpty ? "Campo obrigatório." : "";

  return !isEmpty;
}

email.addEventListener("input", () => {
  if (email.value.trim() !== "") {
    validateEmail();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateEmail()) {
    email.focus();
  }
});
