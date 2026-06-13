const STORAGE_KEY = "medical-service-reports-v3";
const DRAFT_KEY = "medical-service-report-draft-v3";
const API_BASE = (window.SERVICE_REPORT_API_BASE || "").replace(/\/$/, "");
let sharedStorageAvailable = false;
let authToken = sessionStorage.getItem("serviceReportAuthToken") || "";
const users = {
  "engineer-donghyeok": { name: "Donghyeok Jung", role: "engineer" },
  "engineer-sangmin": { name: "Sangmin Lee", role: "engineer" },
  "engineer-minhyuk": { name: "Minhyuk Lee", role: "engineer" },
  admin: { name: "Service Manager", role: "admin" },
};
const engineerNames = ["Donghyeok Jung", "Sangmin Lee", "Minhyuk Lee"];
const SAVED_REPORTS_PAGE_SIZE = 5;
let savedReportsPage = 1;

const form = document.getElementById("reportForm");
const printArea = document.getElementById("printArea");
const printViewport = document.getElementById("printViewport");
const printFrame = document.getElementById("printFrame");
const reportList = document.getElementById("reportList");
const savedCount = document.getElementById("savedCount");
const errorsBox = document.getElementById("errors");
const saveState = document.getElementById("saveState");
const workLogRows = document.getElementById("workLogRows");
const partRows = document.getElementById("partRows");
const totalWorkTime = document.getElementById("totalWorkTime");
const roleSelect = document.getElementById("roleSelect");
const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const showPassword = document.getElementById("showPassword");
const loginMessage = document.getElementById("loginMessage");

const fieldNames = [
  "id", "country", "hospital", "customerName", "installationSite", "deviceModel", "serialNo",
  "manufDate", "installDate", "reportDate", "requestPhone", "requestDistributor", "requestOther",
  "requestOtherText", "serviceWarranty", "serviceContract", "serviceOnCall", "reasonForVisit",
  "serviceActivity", "signatureCustomerName", "fseName", "customerSignatureDataUrl", "fseSignatureDataUrl",
];

const requiredLabels = {
  hospital: "Hospital",
  customerName: "Customer Name",
  deviceModel: "Device / Model",
  serialNo: "Serial No.",
  reasonForVisit: "Reason for Visit",
  serviceActivity: "Service Activity",
  fseName: "FSE Name",
};

class SignaturePad {
  constructor(canvas, hiddenInput) {
    this.canvas = canvas;
    this.hiddenInput = hiddenInput;
    this.ctx = canvas.getContext("2d");
    this.drawing = false;
    this.resize = this.resize.bind(this);
    this.bind();
    this.resize();
  }
  bind() {
    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointerdown", (event) => this.start(event));
    this.canvas.addEventListener("pointermove", (event) => this.move(event));
    window.addEventListener("pointerup", () => this.end());
    this.canvas.addEventListener("pointerleave", () => this.end());
  }
  resize() {
    const data = this.hiddenInput.value;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#111827";
    this.clearSurface();
    if (data) this.drawImage(data);
  }
  clearSurface() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = "#667085";
    this.ctx.font = "13px Arial";
    this.ctx.fillText("Sign here", 12, 22);
  }
  clearGuide() {
    if (this.hiddenInput.value) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(0, 0, rect.width, rect.height);
  }
  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  start(event) {
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    const p = this.point(event);
    this.drawing = true;
    this.clearGuide();
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
  }
  move(event) {
    if (!this.drawing) return;
    event.preventDefault();
    const p = this.point(event);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
  }
  end() {
    if (!this.drawing) return;
    this.drawing = false;
    this.hiddenInput.value = this.canvas.toDataURL("image/png");
    markDirty();
  }
  drawImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.clearSurface();
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  }
  load(dataUrl) {
    this.hiddenInput.value = dataUrl || "";
    dataUrl ? this.drawImage(dataUrl) : this.clearSurface();
  }
  clear() {
    this.hiddenInput.value = "";
    this.clearSurface();
    markDirty();
  }
}

const customerPad = new SignaturePad(document.getElementById("customerSignatureCanvas"), form.elements.customerSignatureDataUrl);
const fsePad = new SignaturePad(document.getElementById("fseSignatureCanvas"), form.elements.fseSignatureDataUrl);

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function currentUser() {
  return users[roleSelect.value] || users["engineer-minhyuk"];
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function requestJson(method, url, body) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${url}`, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (authToken) xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    xhr.send(body === undefined ? null : JSON.stringify(body));
    if (xhr.status < 200 || xhr.status >= 300) throw new Error(xhr.statusText);
    return xhr.responseText ? JSON.parse(xhr.responseText) : null;
  } catch {
    return null;
  }
}
function requestStatus(method, url, body) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${url}`, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (authToken) xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    xhr.send(body === undefined ? null : JSON.stringify(body));
    return {
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      data: xhr.responseText ? JSON.parse(xhr.responseText) : null,
    };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message || "Network error" } };
  }
}
function refreshSharedStorageStatus() {
  sharedStorageAvailable = Boolean(requestJson("GET", "/api/health"));
  const badge = document.getElementById("storageBadge");
  if (badge) {
    badge.textContent = sharedStorageAvailable ? "Shared server DB" : "Local browser DB";
    badge.className = sharedStorageAvailable ? "storage-badge shared" : "storage-badge local";
  }
}
function login(userKey, password) {
  const health = requestStatus("GET", "/api/health");
  if (!health.ok) {
    loginMessage.textContent = "API server is not reachable. Wait 30 seconds and try again.";
    return false;
  }
  const result = requestStatus("POST", "/api/login", { userKey, password: password.trim() });
  if (!result.ok || !result.data?.token) {
    loginMessage.textContent = result.status === 401
      ? "Password is incorrect for the selected account."
      : "Login failed. API server responded with an error.";
    return false;
  }
  authToken = result.data.token;
  sessionStorage.setItem("serviceReportAuthToken", authToken);
  sessionStorage.setItem("serviceReportUserKey", userKey);
  roleSelect.value = userKey;
  roleSelect.disabled = true;
  document.body.classList.remove("locked");
  document.getElementById("authGate").hidden = true;
  refreshSharedStorageStatus();
  syncUserToForm();
  roleSelect.dispatchEvent(new Event("change"));
  renderAllManagement();
  return true;
}
function logout() {
  authToken = "";
  sessionStorage.removeItem("serviceReportAuthToken");
  sessionStorage.removeItem("serviceReportUserKey");
  roleSelect.disabled = false;
  loginPassword.value = "";
  loginMessage.textContent = "";
  document.body.classList.add("locked");
  document.getElementById("authGate").hidden = false;
  sharedStorageAvailable = false;
  refreshSharedStorageStatus();
}
function reports() {
  const source = sharedStorageAvailable ? requestJson("GET", "/api/reports") || [] : readJson(STORAGE_KEY, []);
  return source.map((report) => ({
    status: report.status || (report.completedAt ? "submitted" : "draft"),
    auditLogs: report.auditLogs || [],
    createdBy: report.createdBy || { name: report.fseName || "Minhyuk Lee", role: "engineer" },
    reportNo: report.reportNo || generateReportNo(report.reportDate || today()),
    ...report,
  }));
}
function saveReports(next, mode = "merge") {
  if (sharedStorageAvailable) requestJson("PUT", "/api/reports", { reports: next, mode });
  else writeJson(STORAGE_KEY, next);
  renderAllManagement();
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function compact(value, fallback = "-") {
  return escapeHtml(value || fallback);
}
function addAudit(report, action, message) {
  const user = currentUser();
  const log = { id: createId(), reportId: report.id, action, actorName: user.name, actorRole: user.role, message, createdAt: new Date().toISOString() };
  return { ...report, auditLogs: [...(report.auditLogs || []), log] };
}
function generateReportNo(date) {
  const day = (date || today()).replaceAll("-", "");
  const sameDay = reports().filter((item) => (item.reportNo || "").startsWith(`SR-${day}`)).length + 1;
  return `SR-${day}-${String(sameDay).padStart(3, "0")}`;
}

function checkedText(items) {
  return items.filter((item) => item.checked).map((item) => item.label).join(", ") || "-";
}
function collectWorkLogs() {
  return [...workLogRows.querySelectorAll("tr")].map((row) => ({
    id: row.dataset.id,
    date: row.querySelector('[data-field="date"]').value,
    engineer: row.querySelector('[data-field="engineer"]').value.trim(),
    start: row.querySelector('[data-field="start"]').value,
    end: row.querySelector('[data-field="end"]').value,
    hrs: Number(row.querySelector('[data-field="hrs"]').value) || 0,
    mins: Number(row.querySelector('[data-field="mins"]').value) || 0,
    type: row.querySelector('[data-field="type"]').value,
  }));
}
function collectParts() {
  return [...partRows.querySelectorAll("tr")].map((row) => ({
    id: row.dataset.id,
    partNumber: row.querySelector('[data-field="partNumber"]').value.trim(),
    description: row.querySelector('[data-field="description"]').value.trim(),
    qty: row.querySelector('[data-field="qty"]').value === "" ? "" : Number(row.querySelector('[data-field="qty"]').value),
    remarks: row.querySelector('[data-field="remarks"]').value.trim(),
  }));
}
function formData() {
  const data = {};
  fieldNames.forEach((name) => {
    const el = form.elements[name];
    if (!el) return;
    data[name] = el.type === "checkbox" ? el.checked : el.value.trim();
  });
  if (form.dataset.reportNo) data.reportNo = form.dataset.reportNo;
  if (form.dataset.status) data.status = form.dataset.status;
  data.workLogs = collectWorkLogs();
  data.parts = collectParts().filter((part) => part.partNumber || part.description || part.qty !== "" || part.remarks);
  return data;
}

function defaultWorkLog() {
  return { id: createId(), date: form.elements.reportDate.value || today(), engineer: form.elements.fseName.value || currentUser().name, start: "", end: "", hrs: 0, mins: 0, type: "Working" };
}
function defaultPart() {
  return { id: createId(), partNumber: "", description: "", qty: "", remarks: "" };
}
function renderWorkLogs(logs) {
  workLogRows.innerHTML = logs.map(workLogRow).join("");
}
function workLogRow(log) {
  return `<tr data-id="${compact(log.id || createId())}">
    <td><input type="date" data-field="date" value="${compact(log.date, "")}" /></td>
    <td>
      <select data-field="engineer">
        ${engineerNames.map((name) => `<option value="${name}" ${name === log.engineer ? "selected" : ""}>${name}</option>`).join("")}
      </select>
    </td>
    <td><input type="time" data-field="start" value="${compact(log.start, "")}" /></td>
    <td><input type="time" data-field="end" value="${compact(log.end, "")}" /></td>
    <td><input data-field="hrs" value="${compact(log.hrs || 0)}" readonly /></td>
    <td><input data-field="mins" value="${compact(log.mins || 0)}" readonly /></td>
    <td><select data-field="type">${["Trav", "Working", "Trav Back", "Other"].map((type) => `<option value="${type}" ${type === log.type ? "selected" : ""}>${type}</option>`).join("")}</select></td>
    <td><button class="icon danger" type="button" data-delete-work>Delete</button></td>
  </tr>`;
}
function renderParts(parts) {
  partRows.innerHTML = parts.map(partRow).join("");
}
function partRow(part) {
  return `<tr data-id="${compact(part.id || createId())}">
    <td><input data-field="partNumber" value="${compact(part.partNumber, "")}" /></td>
    <td><input data-field="description" value="${compact(part.description, "")}" /></td>
    <td><input type="number" min="0" step="1" data-field="qty" value="${compact(part.qty, "")}" /></td>
    <td><input data-field="remarks" value="${compact(part.remarks, "")}" /></td>
    <td><button class="icon danger" type="button" data-delete-part>Delete</button></td>
  </tr>`;
}
function calculateTimes() {
  [...workLogRows.querySelectorAll("tr")].forEach((row) => {
    const start = row.querySelector('[data-field="start"]').value;
    const end = row.querySelector('[data-field="end"]').value;
    const hrs = row.querySelector('[data-field="hrs"]');
    const mins = row.querySelector('[data-field="mins"]');
    if (!start || !end) {
      hrs.value = 0;
      mins.value = 0;
      return;
    }
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = Math.max(0, eh * 60 + em - (sh * 60 + sm));
    hrs.value = Math.floor(diff / 60);
    mins.value = diff % 60;
  });
  const total = collectWorkLogs().reduce((sum, log) => sum + log.hrs * 60 + log.mins, 0);
  totalWorkTime.textContent = `${Math.floor(total / 60)} Hrs ${total % 60} Mins`;
}

function validate(data) {
  const messages = [];
  Object.entries(requiredLabels).forEach(([key, label]) => {
    if (!data[key]) messages.push(`${label} is required.`);
  });
  if (!data.workLogs.length) messages.push("At least one working time row is required.");
  data.workLogs.forEach((log, index) => {
    if (!log.date || !log.engineer || !log.start || !log.end) messages.push(`Working time row ${index + 1}: Date, Engineer, Start, and End are required.`);
    if (log.start && log.end) {
      const [sh, sm] = log.start.split(":").map(Number);
      const [eh, em] = log.end.split(":").map(Number);
      if (eh * 60 + em < sh * 60 + sm) messages.push(`Working time row ${index + 1}: End cannot be earlier than Start.`);
    }
  });
  return messages;
}
function showErrors(messages) {
  errorsBox.innerHTML = messages.map((m) => `<div>${escapeHtml(m)}</div>`).join("");
  errorsBox.classList.toggle("show", messages.length > 0);
  if (messages.length) errorsBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fillForm(report) {
  form.reset();
  fieldNames.forEach((name) => {
    const el = form.elements[name];
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(report[name]);
    else el.value = report[name] || "";
  });
  renderWorkLogs(report.workLogs?.length ? report.workLogs : [defaultWorkLog()]);
  renderParts(report.parts || []);
  customerPad.load(report.customerSignatureDataUrl || "");
  fsePad.load(report.fseSignatureDataUrl || "");
  form.dataset.reportNo = report.reportNo || "";
  form.dataset.status = report.status || "draft";
  saveState.textContent = `${report.reportNo || "Draft"} / ${report.status || "draft"}`;
  updateAll();
  showView("createView");
}
function newReport(skipConfirm = false) {
  const hasText = form.elements.hospital.value || form.elements.reasonForVisit.value || form.elements.serviceActivity.value;
  if (!skipConfirm && hasText && !confirm("Clear only the current form and start a new report?\n\nSubmitted reports will stay in Saved Reports.")) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.customerSignatureDataUrl.value = "";
  form.elements.fseSignatureDataUrl.value = "";
  form.dataset.reportNo = "";
  form.dataset.status = "";
  form.elements.country.value = "Korea";
  form.elements.reportDate.value = today();
  syncUserToForm();
  renderWorkLogs([defaultWorkLog()]);
  renderParts([]);
  customerPad.load("");
  fsePad.load("");
  saveState.textContent = "Draft";
  showErrors([]);
  updateAll();
}

function saveReport(submit) {
  updateAll();
  const data = formData();
  const errors = submit ? validate(data) : [];
  showErrors(errors);
  if (errors.length) return false;
  const all = reports();
  const existing = all.find((item) => item.id === data.id);
  const now = new Date().toISOString();
  let record = {
    ...existing,
    ...data,
    id: existing?.id || createId(),
    reportNo: existing?.reportNo || generateReportNo(data.reportDate || today()),
    status: submit ? "submitted" : existing?.status || "draft",
    createdBy: existing?.createdBy || currentUser(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    submittedAt: submit ? existing?.submittedAt || now : existing?.submittedAt,
    deletedAt: existing?.deletedAt,
    auditLogs: existing?.auditLogs || [],
  };
  record = addAudit(record, submit ? "submitted" : existing ? "updated" : "created", submit ? "Report submitted." : "Report saved as draft.");
  saveReports(existing ? all.map((item) => (item.id === record.id ? record : item)) : [record, ...all]);
  form.dataset.reportNo = record.reportNo;
  form.dataset.status = record.status;
  renderPreview(record);
  if (submit) {
    const cleanDraft = { ...formData(), id: "" };
    delete cleanDraft.reportNo;
    delete cleanDraft.status;
    form.elements.id.value = "";
    writeJson(DRAFT_KEY, cleanDraft);
    saveState.textContent = `${record.reportNo} / submitted - ready for new`;
  } else {
    form.elements.id.value = record.id;
    saveState.textContent = `${record.reportNo} / ${record.status}`;
  }
  return true;
}
function saveDraft() {
  writeJson(DRAFT_KEY, formData());
  saveState.textContent = "Auto-saved";
}
function markDirty() {
  if (!form.elements.id.value && form.dataset.status === "submitted") {
    form.dataset.reportNo = "";
    form.dataset.status = "";
  }
  updateAll();
  window.clearTimeout(markDirty.timer);
  markDirty.timer = window.setTimeout(saveDraft, 300);
}
function updateAll() {
  calculateTimes();
  renderPreview(formData());
}

function fitPreviewToWidth() {
  if (!printViewport || !printFrame || !printArea || window.matchMedia("print").matches) return;
  printArea.style.setProperty("--preview-scale", "1");
  const sheetWidth = printArea.offsetWidth;
  const sheetHeight = printArea.offsetHeight;
  const availableWidth = Math.max(1, printViewport.clientWidth - 2);
  const scale = Math.min(1, availableWidth / sheetWidth);
  printArea.style.setProperty("--preview-scale", String(scale));
  printFrame.style.width = `${Math.ceil(sheetWidth * scale)}px`;
  printFrame.style.height = `${Math.ceil(sheetHeight * scale)}px`;
}

function renderPreview(data) {
  const method = checkedText([
    { label: "Phone", checked: data.requestPhone },
    { label: "Distributor", checked: data.requestDistributor },
    { label: data.requestOtherText ? `Other: ${data.requestOtherText}` : "Other", checked: data.requestOther },
  ]);
  const service = checkedText([
    { label: "Warranty", checked: data.serviceWarranty },
    { label: "Service contract", checked: data.serviceContract },
    { label: "On-call", checked: data.serviceOnCall },
  ]);
  const status = data.status || "draft";
  printArea.innerHTML = `
    <div class="sr-header">
      <div>
        <h2>SERVICE REPORT</h2>
        <div class="meta-line">${compact(data.reportNo || "Not submitted")} &nbsp; | &nbsp; ${compact(status)}</div>
      </div>
      <img src="./livanova-logo.png" alt="LivaNova" />
    </div>
    <table class="sr-info">
      <tbody>
        <tr><th>Country</th><td>${compact(data.country)}</td><th>Hospital</th><td>${compact(data.hospital)}</td></tr>
        <tr><th>Customer</th><td>${compact(data.customerName)}</td><th>Installation Site</th><td>${compact(data.installationSite)}</td></tr>
        <tr><th>Device / Model</th><td>${compact(data.deviceModel)}</td><th>Serial No.</th><td>${compact(data.serialNo)}</td></tr>
        <tr><th>Manuf. Date</th><td>${compact(data.manufDate)}</td><th>Install Date</th><td>${compact(data.installDate)}</td></tr>
        <tr><th>Report Date</th><td>${compact(data.reportDate)}</td><th>Request Method</th><td>${compact(method)}</td></tr>
        <tr><th>Service Type</th><td colspan="3">${compact(service)}</td></tr>
      </tbody>
    </table>
    ${srText("Reason for Visit", data.reasonForVisit, "reason-box")}
    ${srText("Service Activity", data.serviceActivity, "activity-box")}
    <div class="sr-section-title">Working Time</div>
    ${srTable(["Date", "Engineer", "Start", "End", "Hrs", "Mins", "Type"], (data.workLogs || []).slice(0, 5).map((log) => [log.date, log.engineer, log.start, log.end, log.hrs, log.mins, log.type]))}
    <div class="sr-total">Total: ${escapeHtml(totalWorkTime.textContent)}</div>
    <div class="sr-section-title">Parts Used</div>
    ${data.parts?.length ? srTable(["Part Number", "Description", "Qty", "Remarks"], data.parts.slice(0, 4).map((p) => [p.partNumber, p.description, p.qty, p.remarks])) : '<div class="sr-empty">No parts used.</div>'}
    <div class="sr-signatures">
      ${srSignature("Customer Signature", data.signatureCustomerName || data.customerName, data.customerSignatureDataUrl)}
      ${srSignature("FSE Signature", data.fseName, data.fseSignatureDataUrl)}
    </div>
    <footer class="sr-footer">
      <strong>LivaNova Korea Ltd.</strong> &nbsp; +82 02. 2138. 0609 &nbsp; Sparkplus #206, Lotte World Wellbeing Center, Olympic-ro 240, Songpa-gu, Seoul
    </footer>
  `;
  requestAnimationFrame(fitPreviewToWidth);
}
function srText(title, body, className) {
  return `<div class="sr-section-title">${escapeHtml(title)}</div><div class="sr-text ${className}">${escapeHtml(body || "-")}</div>`;
}
function srTable(headers, rows) {
  const body = rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${compact(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">-</td></tr>`;
  return `<table class="sr-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}
function srSignature(label, name, dataUrl) {
  return `<figure>${dataUrl ? `<img src="${dataUrl}" alt="${escapeHtml(label)}" />` : '<div class="no-sign">No signature</div>'}<figcaption>${escapeHtml(label)} / ${compact(name)}</figcaption></figure>`;
}

function statusBadge(status) {
  return `<span class="status status-${status || "draft"}">${escapeHtml(status || "draft")}</span>`;
}
function renderCards(container, rows, includeDeleted = false) {
  const list = rows.filter((r) => includeDeleted || r.status !== "deleted");
  if (!list.length) {
    container.innerHTML = '<p class="empty-list">No reports.</p>';
    return;
  }
  container.innerHTML = `<div class="responsive-table"><table><thead><tr>
    <th>Report No.</th><th>Date</th><th>Hospital</th><th>Customer</th><th>Device</th><th>Serial</th><th>FSE</th><th>Status</th><th>Updated</th><th>Actions</th>
  </tr></thead><tbody>${list.map((r) => `<tr>
    <td>${compact(r.reportNo)}</td><td>${compact(r.reportDate)}</td><td>${compact(r.hospital)}</td><td>${compact(r.customerName)}</td>
    <td>${compact(r.deviceModel)}</td><td>${compact(r.serialNo)}</td><td>${compact(r.fseName)}</td><td>${statusBadge(r.status)}</td><td>${compact((r.updatedAt || "").slice(0, 10))}</td>
    <td class="action-cell">
      <button data-action="view" data-id="${r.id}">View</button>
      <button data-action="edit" data-id="${r.id}">Edit</button>
      <button data-action="pdf" data-id="${r.id}">PDF</button>
      ${r.status === "deleted" ? `<button data-action="restore" data-id="${r.id}">Restore</button><button data-action="permanent" data-id="${r.id}">Delete forever</button>` : `<button data-action="delete" data-id="${r.id}">Delete</button>`}
    </td>
  </tr>`).join("")}</tbody></table></div>`;
}
function filteredReports() {
  const q = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const status = document.getElementById("statusFilter")?.value || "active";
  const dateFilter = document.getElementById("dateFilter")?.value || "all";
  const sort = document.getElementById("sortSelect")?.value || "newest";
  let list = reports();
  if (status === "active") list = list.filter((r) => r.status !== "deleted");
  else if (status !== "all") list = list.filter((r) => r.status === status);
  if (q) list = list.filter((r) => [r.reportNo, r.hospital, r.customerName, r.deviceModel, r.serialNo, r.fseName].join(" ").toLowerCase().includes(q));
  if (dateFilter !== "all") {
    const days = dateFilter === "today" ? 0 : Number(dateFilter);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    list = list.filter((r) => new Date(r.createdAt || r.reportDate) >= cutoff);
  }
  return list.sort((a, b) => {
    if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === "hospital") return (a.hospital || "").localeCompare(b.hospital || "");
    if (sort === "updated") return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}
function renderAllManagement() {
  const all = reports();
  const savedReports = all.filter((r) => r.status !== "deleted");
  const savedPages = Math.max(1, Math.ceil(savedReports.length / SAVED_REPORTS_PAGE_SIZE));
  savedReportsPage = Math.min(Math.max(1, savedReportsPage), savedPages);
  const savedStart = (savedReportsPage - 1) * SAVED_REPORTS_PAGE_SIZE;
  const visibleSavedReports = savedReports.slice(savedStart, savedStart + SAVED_REPORTS_PAGE_SIZE);
  savedCount.textContent = String(savedReports.length);
  reportList.innerHTML = visibleSavedReports.map((r) => `<article class="report-item"><strong>${compact(r.hospital)}</strong><small>${compact(r.reportNo)} / ${compact(r.deviceModel)} / ${compact(r.reportDate)}</small><small>${statusBadge(r.status)}</small><div class="item-actions"><button data-load="${r.id}">Load</button><button data-list-delete="${r.id}">Delete</button></div></article>`).join("") || '<p class="empty-list">No saved reports.</p>';
  if (savedReports.length > SAVED_REPORTS_PAGE_SIZE) {
    reportList.insertAdjacentHTML("beforeend", `<div class="list-pager"><button data-saved-page="${savedReportsPage - 1}" ${savedReportsPage <= 1 ? "disabled" : ""}>Prev</button><span>${savedReportsPage} / ${savedPages}</span><button data-saved-page="${savedReportsPage + 1}" ${savedReportsPage >= savedPages ? "disabled" : ""}>Next</button></div>`);
  }
  renderCards(document.getElementById("engineerReports"), all.filter((r) => r.createdBy?.name === currentUser().name || r.fseName === currentUser().name));
  renderCards(document.getElementById("adminReports"), filteredReports());
  renderCards(document.getElementById("trashReports"), all.filter((r) => r.status === "deleted"), true);
  const count = (s) => all.filter((r) => r.status === s).length;
  document.getElementById("dashboardCards").innerHTML = [
    ["Total", all.length], ["Today", all.filter((r) => r.createdAt?.slice(0, 10) === today()).length],
    ["Submitted", count("submitted")], ["Reviewed", count("reviewed")], ["Completed", count("completed")], ["Deleted", count("deleted")],
  ].map(([label, value]) => `<div class="dash-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
  renderCards(document.getElementById("recentReports"), all.filter((r) => r.status !== "deleted").slice(0, 5));
}

function softDelete(id) {
  const reason = prompt("Delete this service report? Deleted reports can be restored in Admin Trash. Enter delete reason:");
  if (reason === null) return;
  const all = reports();
  saveReports(all.map((r) => {
    if (r.id !== id) return r;
    return addAudit({ ...r, status: "deleted", deletedAt: new Date().toISOString(), deletedBy: currentUser().name, deleteReason: reason || "No reason" }, "deleted", `Deleted: ${reason || "No reason"}`);
  }));
}
function restoreReport(id) {
  saveReports(reports().map((r) => r.id === id ? addAudit({ ...r, status: "submitted", deletedAt: "", deletedBy: "", deleteReason: "" }, "restored", "Report restored.") : r));
}
function permanentDelete(id) {
  if (!confirm("Permanent delete cannot be restored. Really delete forever?")) return;
  saveReports(reports().filter((r) => r.id !== id), "replace");
}
function changeStatus(id, status) {
  saveReports(reports().map((r) => r.id === id ? addAudit({ ...r, status, updatedAt: new Date().toISOString() }, "status_changed", `Status changed to ${status}.`) : r));
}
function handleReportAction(action, id) {
  const report = reports().find((r) => r.id === id);
  if (!report) return;
  if (action === "view" || action === "edit") fillForm(report);
  if (action === "pdf") {
    fillForm(report);
    printReport(false);
  }
  if (action === "delete") softDelete(id);
  if (action === "restore") restoreReport(id);
  if (action === "permanent") permanentDelete(id);
}
function showView(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== id));
  renderAllManagement();
}
function printReport(validateFirst = true) {
  updateAll();
  if (validateFirst) {
    const errors = validate(formData());
    showErrors(errors);
    if (errors.length) return;
  }
  const data = formData();
  const safeHospital = (data.hospital || "hospital").replace(/[\\/:*?"<>| ]+/g, "-");
  const safeDate = data.reportDate || today();
  const oldTitle = document.title;
  document.title = `service-report_${safeHospital}_${safeDate}`;
  window.print();
  setTimeout(() => (document.title = oldTitle), 1000);
}

form.addEventListener("input", markDirty);
window.addEventListener("resize", fitPreviewToWidth);
workLogRows.addEventListener("input", markDirty);
partRows.addEventListener("input", markDirty);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveReport(true);
});
document.getElementById("newReportBtn").addEventListener("click", () => newReport(false));
document.getElementById("draftBtn").addEventListener("click", () => saveReport(false));
document.getElementById("loadDraftBtn").addEventListener("click", () => fillForm(readJson(DRAFT_KEY, formData())));
document.getElementById("printBtn").addEventListener("click", () => printReport(true));
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("addWorkLogBtn").addEventListener("click", () => {
  workLogRows.insertAdjacentHTML("beforeend", workLogRow(defaultWorkLog()));
  markDirty();
});
document.getElementById("addPartBtn").addEventListener("click", () => {
  partRows.insertAdjacentHTML("beforeend", partRow(defaultPart()));
  markDirty();
});
workLogRows.addEventListener("click", (event) => {
  if (!event.target.matches("[data-delete-work]")) return;
  if (workLogRows.querySelectorAll("tr").length <= 1) return showErrors(["At least one working time row is required."]);
  event.target.closest("tr").remove();
  markDirty();
});
partRows.addEventListener("click", (event) => {
  if (!event.target.matches("[data-delete-part]")) return;
  event.target.closest("tr").remove();
  markDirty();
});
document.querySelectorAll("[data-clear-signature]").forEach((button) => {
  button.addEventListener("click", () => button.dataset.clearSignature === "customer" ? customerPad.clear() : fsePad.clear());
});
document.body.addEventListener("click", (event) => {
  const view = event.target.dataset.view;
  if (view) showView(view);
  const action = event.target.dataset.action;
  if (action) handleReportAction(action, event.target.dataset.id);
  const load = event.target.dataset.load;
  if (load) fillForm(reports().find((r) => r.id === load));
  const listDelete = event.target.dataset.listDelete;
  if (listDelete) softDelete(listDelete);
  const savedPage = event.target.dataset.savedPage;
  if (savedPage) {
    savedReportsPage = Number(savedPage);
    renderAllManagement();
  }
});
["searchInput", "statusFilter", "dateFilter", "sortSelect"].forEach((id) => document.getElementById(id)?.addEventListener("input", renderAllManagement));
roleSelect.addEventListener("change", () => {
  const isAdmin = roleSelect.value === "admin";
  document.querySelectorAll("[data-admin-only]").forEach((el) => el.hidden = !isAdmin);
  syncUserToForm();
  if (!isAdmin && !["createView", "engineerReportsView"].includes(document.querySelector(".view:not(.hidden)")?.id)) showView("createView");
});

function syncUserToForm() {
  const user = currentUser();
  if (user.role === "engineer" && form.elements.fseName) {
    form.elements.fseName.value = user.name;
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  login(loginUser.value, loginPassword.value);
});

showPassword.addEventListener("change", () => {
  loginPassword.type = showPassword.checked ? "text" : "password";
});

newReport(true);
const draft = readJson(DRAFT_KEY, null);
if (draft) fillForm(draft);
refreshSharedStorageStatus();
const savedUserKey = sessionStorage.getItem("serviceReportUserKey");
if (authToken && savedUserKey) {
  roleSelect.value = savedUserKey;
  roleSelect.disabled = true;
  document.body.classList.remove("locked");
  document.getElementById("authGate").hidden = true;
  roleSelect.dispatchEvent(new Event("change"));
  renderAllManagement();
} else {
  roleSelect.dispatchEvent(new Event("change"));
}
requestAnimationFrame(fitPreviewToWidth);
