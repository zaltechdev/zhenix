"use client";

import { useState, useEffect } from "react";
import {
  Undo,
  Redo,
  Printer,
  PaintBucket,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Table as TableIcon
} from "lucide-react";
import { GoogleSuiteHeader, GoogleCompanionBar, GoogleShareModal } from "@/components/workspace/google-suite-shell";

const INITIAL_GRID_DATA: Record<string, string> = {
  "A1": "Year", "B1": "Europe", "C1": "Asia", "D1": "Africa", "E1": "Americas",
  "A2": "1500", "B2": "85", "C2": "225", "D2": "85", "E2": "41",
  "A3": "1600", "B3": "100", "C3": "380", "D3": "100", "E3": "20",
  "A4": "1700", "B4": "120", "C4": "400", "D4": "120", "E4": "15",
  "A5": "1800", "B5": "200", "C5": "635", "D5": "120", "E5": "25",
  "A6": "1900", "B6": "430", "C6": "947", "D6": "133", "E6": "74"
};

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
const ROWS = Array.from({ length: 18 }, (_, i) => i + 1);

export function GoogleSheetsView() {
  const [sheetTitle, setSheetTitle] = useState("Historical Analysis");
  const [selectedCell, setSelectedCell] = useState("A1");
  const [gridData, setGridData] = useState<Record<string, string>>(INITIAL_GRID_DATA);
  const [formulaValue, setFormulaValue] = useState(INITIAL_GRID_DATA["A1"] || "");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const activeTab = "Historical Data";

  const handleSelectCell = (cellId: string) => {
    setSelectedCell(cellId);
    setFormulaValue(gridData[cellId] || "");
  };

  const handleCellChange = (cellId: string, value: string) => {
    setGridData((prev) => ({ ...prev, [cellId]: value }));
  };

  useEffect(() => {
    const handleSheetUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ cell?: string; value: string; values?: Record<string, string> }>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.values) {
        setGridData((prev) => ({ ...prev, ...detail.values }));
      } else if (detail.cell && detail.value !== undefined) {
        handleCellChange(detail.cell, detail.value);
      }
    };

    window.addEventListener("aksa:sheet_update", handleSheetUpdate);
    return () => {
      window.removeEventListener("aksa:sheet_update", handleSheetUpdate);
    };
  }, []);

  return (
    <div className="gsuite-container">
      {/* 1:1 Google Sheets Header */}
      <GoogleSuiteHeader
        app="sheets"
        title={sheetTitle}
        onTitleChange={setSheetTitle}
        onOpenShare={() => setShareModalOpen(true)}
      />

      {/* 1:1 Google Sheets Toolbar */}
      <div className="gsuite-toolbar" role="toolbar" aria-label="Sheets toolbar">
        <button type="button" className="gsuite-toolbar__btn" title="Undo"><Undo className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn" title="Redo"><Redo className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn" title="Print"><Printer className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn" title="Paint format"><PaintBucket className="w-4 h-4" /></button>

        <div className="gsuite-toolbar__divider" />

        <select className="gsuite-toolbar__select" defaultValue="100%">
          <option>100%</option>
          <option>90%</option>
          <option>125%</option>
        </select>

        <button type="button" className="gsuite-toolbar__btn font-semibold" title="Format as currency">£</button>
        <button type="button" className="gsuite-toolbar__btn font-semibold" title="Format as percent">%</button>
        <button type="button" className="gsuite-toolbar__btn font-semibold" title="Decrease decimal places">.0</button>
        <button type="button" className="gsuite-toolbar__btn font-semibold" title="Increase decimal places">.00</button>
        <button type="button" className="gsuite-toolbar__btn font-semibold" title="More formats">123</button>

        <div className="gsuite-toolbar__divider" />

        <select className="gsuite-toolbar__select" defaultValue="Roboto">
          <option>Roboto</option>
          <option>Arial</option>
          <option>Montserrat</option>
        </select>

        <div className="gsuite-toolbar__divider" />

        <button type="button" className="gsuite-toolbar__btn font-bold"><Bold className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn italic"><Italic className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn"><AlignLeft className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn"><AlignCenter className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn"><AlignRight className="w-4 h-4" /></button>
      </div>

      {/* Formula Bar */}
      <div className="gsheets-formula-row">
        <span className="gsheets-cell-name">{selectedCell}</span>
        <span className="gsheets-fx-icon">fx</span>
        <input
          type="text"
          className="gsheets-formula-input"
          value={formulaValue}
          onChange={(e) => {
            setFormulaValue(e.target.value);
            handleCellChange(selectedCell, e.target.value);
          }}
          placeholder="Enter formula or value..."
        />
      </div>

      {/* Main Work Area: Spreadsheet Grid + Companion Bar */}
      <div className="gsuite-work-area">
        <div className="gsheets-grid-container">
          <table className="gsheets-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }} />
                {COLUMNS.map((col) => (
                  <th key={col} style={{ width: col === "A" ? "90px" : "110px" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row}>
                  <th>{row}</th>
                  {COLUMNS.map((col) => {
                    const cellId = `${col}${row}`;
                    const isSelected = selectedCell === cellId;
                    const val = gridData[cellId] || "";
                    const isHeaderRow = row === 1;

                    return (
                      <td
                        key={cellId}
                        className={isSelected ? "selected" : ""}
                        onClick={() => handleSelectCell(cellId)}
                        style={{
                          fontWeight: isHeaderRow ? 700 : 400,
                          backgroundColor: isHeaderRow ? "rgba(24, 128, 56, 0.08)" : undefined
                        }}
                      >
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleCellChange(cellId, e.target.value)}
                          onFocus={() => handleSelectCell(cellId)}
                          className="w-full bg-transparent border-none outline-none font-inherit text-inherit"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Companion Bar */}
        <GoogleCompanionBar />
      </div>

      {/* Sheets Bottom Tab Bar */}
      <div className="gsheets-tabs-bar">
        <button type="button" className="gsuite-icon-btn" title="Add Sheet">
          <Plus className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-icon-btn" title="All Sheets">
          <TableIcon className="w-4 h-4" />
        </button>
        <div className="gsheets-tab">
          <span>{activeTab}</span>
        </div>
      </div>

      {/* Share Modal Dialog */}
      <GoogleShareModal
        title={sheetTitle}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
