import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles.css";
import { App } from "./ui/App";
import { Gallery } from "./ui/Gallery";

const params = new URLSearchParams(window.location.search);
const root = createRoot(document.getElementById("root")!);
root.render(<StrictMode>{params.has("gallery") ? <Gallery /> : <App />}</StrictMode>);
