import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const treeOptions = [
    "1–5 trees",
    "6–10 trees",
    "11–25 trees",
    "26–50 trees",
    "More than 50 trees",
];
export default function App() {
    return (_jsxs("main", { className: "page-shell", children: [_jsx("div", { className: "staging-banner", children: "STAGING / DEMO" }), _jsxs("section", { className: "hero-card", children: [_jsx("p", { className: "eyebrow", children: "JustCocon" }), _jsx("h1", { children: "Fast, local coconut harvesting support" }), _jsx("p", { className: "subtitle", children: "Schedule a harvest request for your property in Kerala. This demo does not connect to a live database or production WhatsApp number." }), _jsxs("form", { className: "booking-card", "aria-label": "Quick booking form", children: [_jsxs("div", { className: "form-header", children: [_jsx("h2", { children: "Quick booking" }), _jsx("span", { className: "demo-tag", children: "Demo only" })] }), _jsxs("label", { children: ["Location", _jsx("input", { type: "text", placeholder: "Enter your location or farm name", "aria-label": "Location" })] }), _jsxs("label", { children: ["Number of trees", _jsx("select", { "aria-label": "Number of trees", children: treeOptions.map((option) => (_jsx("option", { value: option, children: option }, option))) })] }), _jsxs("label", { children: ["Preferred date", _jsx("input", { type: "date", "aria-label": "Preferred date" })] }), _jsxs("label", { children: ["Notes (optional)", _jsx("textarea", { rows: 3, placeholder: "Share access details, timing, or any special instructions", "aria-label": "Notes" })] }), _jsx("button", { type: "button", className: "primary-button", children: "Book on WhatsApp" }), _jsx("p", { className: "disclaimer", children: "WhatsApp integration is not connected yet. This page is a staging UI foundation only." })] })] })] }));
}
