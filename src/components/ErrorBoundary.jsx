import { Component } from "react";
import { COLORS } from "../theme/colors.js";

// Last-resort catch for a render crash in whichever app is active. Without
// this, an uncaught error unmounts the whole tree (blank white page) and,
// since App.jsx persists the last-open app and reopens straight into it,
// every reload re-enters the same crash with no way back — see
// ARCHITECTURE.md's TaskManagerApp tab-fallback note for the same class of
// "invalid persisted nav state" problem, one level up. Resetting the
// persisted app key and reloading is what gets back to a working state.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReset = () => {
    try {
      localStorage.removeItem("manifest.nav.app");
    } catch {
      // localStorage unavailable — nothing to clear, just reload
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "20px",
          background: COLORS.bg,
          color: COLORS.text,
          fontFamily: "'IBM Plex Mono', monospace",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "13px", color: COLORS.dim }}>something went wrong loading this screen</div>
        <button
          onClick={this.handleReset}
          style={{
            background: COLORS.amber,
            border: "none",
            color: COLORS.bg,
            fontFamily: "inherit",
            fontSize: "12.5px",
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          back to home
        </button>
      </div>
    );
  }
}
