/**
 * Tooltip.jsx — קומפוננטת tooltip עם hover/focus.
 *
 * Usage:
 *   <Tooltip text="הסבר מה זה CPL">
 *     <span>CPL</span>
 *   </Tooltip>
 *
 * Or as a help icon:
 *   <HelpIcon text="מספר לידים שעלה לקבל בממוצע..." />
 */
import React, { useState, useRef, useEffect } from "react";
import { color, radius, shadow, space, fontFamily } from "./_tokens.js";

export default function Tooltip({ text, placement = "top", children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const triggerRef      = useRef(null);

  useEffect(() => {
    if (!show || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (placement === "top") {
      setPos({
        top:  rect.top  + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    } else {
      setPos({
        top:  rect.bottom + window.scrollY + 8,
        left: rect.left   + window.scrollX + rect.width / 2,
      });
    }
  }, [show, placement]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {children}
      </span>
      {show && text && (
        <div role="tooltip" style={{
          position: "absolute",
          top: pos.top, left: pos.left,
          transform: placement === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          background: "#0f172a",
          color: "#fff",
          padding: `${space(2)} ${space(2.5)}`,
          borderRadius: radius.md,
          fontSize: 12,
          fontWeight: 500,
          fontFamily,
          maxWidth: 260,
          lineHeight: 1.5,
          boxShadow: shadow.lg,
          zIndex: 1000,
          pointerEvents: "none",
          direction: "rtl",
          whiteSpace: "normal",
        }}>
          {text}
        </div>
      )}
    </>
  );
}

/** HelpIcon — איקון "?" עגול עם tooltip מובנה. שימושי ליד טרמינולוגיה טכנית. */
export function HelpIcon({ text, size = 14 }) {
  return (
    <Tooltip text={text}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size + 2, height: size + 2,
        borderRadius: "50%",
        background: color.surfaceMuted,
        border: `1px solid ${color.borderDefault}`,
        color: color.fgMuted,
        fontSize: size - 4,
        fontWeight: 700,
        marginInlineStart: space(1),
        cursor: "help",
        fontFamily,
        lineHeight: 1,
      }}>?</span>
    </Tooltip>
  );
}
