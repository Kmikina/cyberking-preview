/** Project brief → mailto draft (same behaviour as the original; nothing is sent by the site). */
export function initForm() {
  const form = document.getElementById("brief");
  if (!form) return;
  const status = document.getElementById("briefStatus");
  const required = [...form.querySelectorAll("[required]")];
  const setStatus = (s) => { if (status) status.textContent = s; };
  let resetTimer = 0;

  function check(input) {
    const v = input.value.trim();
    const ok = input.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : v.length > 0;
    const field = input.closest(".field2");
    if (field) field.classList.toggle("is-invalid", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  }
  form.addEventListener("input", (e) => {
    if (e.target.closest && e.target.closest(".field2.is-invalid")) check(e.target);
  });
  required.forEach((input) => input.addEventListener("blur", () => { if (input.value.trim()) check(input); }));

  const note = document.getElementById("briefNote");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const bad = required.filter((input) => !check(input));
    if (bad.length) {
      setStatus("Incomplete");
      const missing = bad.map((i) => (i.type === "email" ? "a valid email address" : "your name"));
      if (note) note.textContent = "Please add " + missing.join(" and ") + ".";
      bad[0].focus();
      return;
    }
    const d = new FormData(form);
    const name = String(d.get("name") || "").trim();
    const org = String(d.get("organization") || "").trim();
    const email = String(d.get("email") || "").trim();
    const interests = d.getAll("interest");
    const message = String(d.get("message") || "").trim();
    const lines = ["Hello Cyber King Services team,", "", "I'd like to start a conversation about a project.", ""];
    lines.push("Name: " + name);
    if (org) lines.push("Organization: " + org);
    lines.push("Email: " + email);
    if (interests.length) lines.push("Area of interest: " + interests.join(", "));
    if (message) lines.push("", "What we're working on:", message);
    lines.push("", "Thank you,", name);
    const href = "mailto:info@cyberkingservices.com?subject=" + encodeURIComponent("Project brief — " + (org || name)) +
      "&body=" + encodeURIComponent(lines.join("\r\n"));
    setStatus("Opening email");
    if (note) note.textContent = "Your email app should open with the draft. If it doesn't, email info@cyberkingservices.com or call (571) 388-0486.";
    window.location.href = href;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => setStatus("Ready"), 6000);
  });
}
