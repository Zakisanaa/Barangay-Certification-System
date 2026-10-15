import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../src/app/App";
import { passwordRecoveryState } from "../../src/app/passwordRecoveryState";
import "../../src/styles/index.css";

const date = new Date(); date.setDate(date.getDate() + 3);
while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const resident = { id: "00000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Dela Cruz", name: "Juan Dela Cruz", email: "resident@example.test", contactNumber: "09931411699", address: "Barangay Lagasit", role: "resident", createdAt: new Date().toISOString() };
const staff = { ...resident, id: "00000000-0000-4000-8000-000000000003", name: "Test Staff", email: "staff@example.test", role: "staff" };
const request = { reference: "BRG-2026-TEST0001", ownerId: resident.id, fullName: resident.name, address: resident.address, voterId: "Voter ID 123", schoolIdImagePath: null, requestType: "Barangay Clearance", purpose: "Employment", date: day, timeSlot: "9:00 AM - 10:00 AM", deliveryFormat: "Softcopy", status: "PENDING", archived: false, submittedAt: new Date().toISOString(), rejectionReason: null };
const config = {
  office: { id: 1, contact_number: "09931411699", contact_email: "barangaylagasit00@gmail.com", office_hours: "Staff confirmed hours", address: "Barangay Lagasit", booking_days_ahead: 90 },
  services: ["Barangay Clearance", "Certificate of Residency", "Good Moral Certificate"].map(request_type => ({ request_type, active: true, softcopy_available: request_type !== "Good Moral Certificate", requirements: "Staff confirmed requirements", fee_description: "", processing_time: "", updated_at: new Date().toISOString() })),
  slots: [{ label: "8:00 AM - 9:00 AM", start_time: "08:00", capacity: 10, active: true }, { label: "9:00 AM - 10:00 AM", start_time: "09:00", capacity: 10, active: true }],
  closures: [],
};
const review = { config, day, resident, staff, account: staff, requests: [request], events: [{ id: "event-1", actor_name: resident.name, status: "PENDING", description: "Request submitted.", created_at: new Date().toISOString() }], deliveries: [], notifications: [], downloads: [], authCallback: null, resetEmail: "", recoveredPassword: "", posts: [], imageUrls: {}, removedImages: [], knowledge: [], chatQuestions: [] };
Object.assign(window, { __review: review });
const root = createRoot(document.getElementById("root")!);
let scenario = 0;
Object.assign(window, { resetReview: (role = "staff", path = "/staff", consumeRecoveryFragment = false) => {
  review.account = role === "staff" ? staff : role === "resident" ? resident : null;
  window.history.replaceState(null, "", path);
  passwordRecoveryState.clear();
  passwordRecoveryState.capture();
  if (consumeRecoveryFragment) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  root.render(<App key={++scenario} />);
} });
(window as any).resetReview();
