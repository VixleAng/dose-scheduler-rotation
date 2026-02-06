{/* Sheet */}
{sheetOpen && selectedSpot && (
  <GlassOverlay onClose={closeSheet} align="bottom">
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        width: "min(760px, 100%)",
        borderRadius: 20,
        border: `1px solid ${UI.line}`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
        overflow: "hidden",
        maxHeight: "88vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: 44,
          height: 5,
          borderRadius: 999,
          background: "rgba(17,17,17,0.18)",
          margin: "10px auto 0",
        }}
      />

      <div
        style={{
          padding: 14,
          borderBottom: `1px solid ${UI.line}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Log injection</div>
          <div style={{ color: UI.muted, fontSize: 13 }}>
            {selectedSpot.label} • {selectedSpot.view}
          </div>
        </div>

        <button
          onClick={closeSheet}
          className="pillHover"
          style={{
            padding: "10px 12px",
            borderRadius: 999,
            border: `1px solid ${UI.line}`,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Close
        </button>
      </div>

      <div style={{ padding: 14, overflowY: "auto" }}>
        {/* (everything inside your sheet stays EXACTLY the same from here down) */}
        {/* Keep the rest of your existing sheet contents unchanged */}
      </div>
    </div>
  </GlassOverlay>
)}
