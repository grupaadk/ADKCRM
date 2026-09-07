"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Play,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  FileCode,
  Sliders,
  DollarSign,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type NodeType = "trigger" | "prompt_component" | "price_source" | "output_format";

type WorkflowNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    componentId?: Id<"aiPromptComponents">;
    priceTables?: string[];
    customText?: string;
  };
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

const SERVICE_OPTIONS = [
  "Zabudowa tarasu",
  "Zadaszenie tarasu",
  "Ściany szklane",
  "General",
];

const PRICE_TABLE_OPTIONS = [
  { id: "polycarbonate", label: "Dach z Poliwęglanu" },
  { id: "glass", label: "Dach ze Szkła" },
  { id: "sliding_walls", label: "Ściany Przesuwne Szklane" },
  { id: "fixed_walls", label: "Ściany Stałe Poliwęglan" },
  { id: "extras", label: "Trójkąty Boczne i Dodatki" },
  { id: "installation", label: "Stawki Montażowe" },
];

export default function WorkflowCanvas() {
  const workflows = useQuery(api.aiWorkflows.listWorkflows) ?? [];
  const promptComponents = useQuery(api.aiWorkflows.listPromptComponents) ?? [];
  const saveDraft = useMutation(api.aiWorkflows.saveWorkflowDraft);
  const activateWf = useMutation(api.aiWorkflows.activateWorkflow);
  const deleteWf = useMutation(api.aiWorkflows.deleteWorkflow);

  const [selectedWfId, setSelectedWfId] = useState<Id<"aiWorkflows"> | null>(null);
  const [serviceType, setServiceType] = useState("Zabudowa tarasu");
  const [title, setTitle] = useState("Workflow Wyceny Tarasów");
  const [description, setDescription] = useState("Automatyczny proces wyceniania zabudów tarasowych ADK");

  // Graf
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    {
      id: "node-1",
      type: "trigger",
      position: { x: 50, y: 120 },
      data: { label: "Wyzwolenie: Zabudowa tarasu" },
    },
    {
      id: "node-2",
      type: "price_source",
      position: { x: 320, y: 60 },
      data: { label: "Cenniki zadaszeń i ścian", priceTables: ["polycarbonate", "glass", "sliding_walls", "installation"] },
    },
    {
      id: "node-3",
      type: "output_format",
      position: { x: 620, y: 120 },
      data: { label: "Karta Wyceny JSON + Odpowiedź" },
    },
  ]);

  const [edges, setEdges] = useState<WorkflowEdge[]>([
    { id: "e1-2", source: "node-1", target: "node-2" },
    { id: "e2-3", source: "node-2", target: "node-3" },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const currentWf = workflows.find((w: any) => w._id === selectedWfId);

  // Załaduj do edytora wybrany workflow
  useEffect(() => {
    if (currentWf) {
      setServiceType(currentWf.serviceType);
      setTitle(currentWf.title);
      setDescription(currentWf.description ?? "");
      setNodes(currentWf.nodes as WorkflowNode[]);
      setEdges(currentWf.edges as WorkflowEdge[]);
    }
  }, [selectedWfId, currentWf]);

  const handleCanvasMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNodeId(nodeId);

    const targetNode = nodes.find((n) => n.id === nodeId);
    if (targetNode) {
      setDragOffset({
        x: e.clientX - targetNode.position.x,
        y: e.clientY - targetNode.position.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId) return;
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const newX = Math.max(10, Math.min(canvasRect.width - 220, e.clientX - canvasRect.left - 80));
    const newY = Math.max(10, Math.min(canvasRect.height - 80, e.clientY - canvasRect.top - 30));

    setNodes((prev) =>
      prev.map((n) => (n.id === draggedNodeId ? { ...n, position: { x: newX, y: newY } } : n))
    );
  };

  const handleCanvasMouseUp = () => {
    setDraggedNodeId(null);
  };

  const handleAddNode = (type: NodeType) => {
    const newId = `node-${Date.now()}`;
    let label = "Nowy Krok";
    if (type === "prompt_component") label = "Komponent Wytycznych";
    if (type === "price_source") label = "Podpięty Cennik";

    const newNode: WorkflowNode = {
      id: newId,
      type,
      position: { x: 200 + nodes.length * 30, y: 150 + (nodes.length % 2) * 50 },
      data: { label },
    };

    // Automatycznie połącz z poprzednim
    const lastNode = nodes[nodes.length - 1];
    setNodes((prev) => [...prev, newNode]);
    if (lastNode) {
      setEdges((prev) => [...prev, { id: `e-${lastNode.id}-${newId}`, source: lastNode.id, target: newId }]);
    }
    setSelectedNodeId(newId);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleSaveDraft = async () => {
    try {
      const savedId = await saveDraft({
        id: selectedWfId ?? undefined,
        serviceType,
        title,
        description,
        nodes,
        edges,
      });
      setSelectedWfId(savedId);
      setStatusMsg({ type: "success", text: "Zapisano wersję roboczą Workflowu (Draft)." });
    } catch (err) {
      setStatusMsg({ type: "error", text: `Błąd zapisu: ${err instanceof Error ? err.message : "Nieznany błąd"}` });
    }
  };

  const handleActivate = async () => {
    if (!selectedWfId) {
      alert("Najpierw zapisz wersję roboczą przed publikacją.");
      return;
    }
    try {
      await activateWf({ id: selectedWfId });
      setStatusMsg({ type: "success", text: "Workflow został OPUBLIKOWANY na produkcję jako aktywny!" });
    } catch (err) {
      setStatusMsg({ type: "error", text: `Błąd publikacji: ${err instanceof Error ? err.message : "Nieznany błąd"}` });
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {statusMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: statusMsg.type === "success" ? "rgba(74, 187, 195, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: statusMsg.type === "success" ? "var(--accent)" : "var(--bad)",
            border: `1px solid ${statusMsg.type === "success" ? "var(--accent-line)" : "rgba(239, 68, 68, 0.2)"}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Pasek narzędzi i wyboru Workflowu */}
      <div className="panel" style={{ padding: 14, borderRadius: 10, display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div>
            <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 2 }}>
              Wybierz Schemat / Usługę
            </label>
            <select
              className="panel"
              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)" }}
              value={selectedWfId ?? ""}
              onChange={(e) => setSelectedWfId((e.target.value as Id<"aiWorkflows">) || null)}
            >
              <option value="">-- Nowy Schemat (Nowy Draft) --</option>
              {workflows.map((w: any) => (
                <option key={w._id} value={w._id}>
                  {w.serviceType} — {w.title} ({w.status.toUpperCase()} v{w.version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 2 }}>
              Typ Usługi
            </label>
            <select
              className="panel"
              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)" }}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 2 }}>
              Nazwa Schematu
            </label>
            <input
              type="text"
              className="panel"
              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)", width: 220 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={handleSaveDraft} style={{ padding: "6px 12px", borderRadius: 6, gap: 6 }}>
            <Save size={14} />
            Zapisz Draft
          </button>
          <button className="btn primary" onClick={handleActivate} style={{ padding: "6px 14px", borderRadius: 6, gap: 6 }}>
            <Play size={14} />
            Publikuj (Aktywuj)
          </button>
        </div>
      </div>

      {/* Wizualny Edytor Canvas w stylu N8N */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, minHeight: 480 }}>
        {/* Płótno Canvas */}
        <div
          className="panel"
          style={{
            position: "relative",
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "var(--panel-2, #f8fafc)",
            backgroundImage: "radial-gradient(var(--line-2, #cbd5e1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            userSelect: "none",
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {/* Pasek dodawania węzłów */}
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, display: "flex", gap: 6 }}>
            <button
              className="btn"
              onClick={() => handleAddNode("prompt_component")}
              style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, gap: 4, backgroundColor: "var(--panel)" }}
            >
              <Plus size={12} /> + Wytyczne (Prompt)
            </button>
            <button
              className="btn"
              onClick={() => handleAddNode("price_source")}
              style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, gap: 4, backgroundColor: "var(--panel)" }}
            >
              <Plus size={12} /> + Podepnij Cennik
            </button>
          </div>

          {/* Linie połączeń (Edges) */}
          <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
            {edges.map((e) => {
              const srcNode = nodes.find((n) => n.id === e.source);
              const tgtNode = nodes.find((n) => n.id === e.target);
              if (!srcNode || !tgtNode) return null;

              const x1 = srcNode.position.x + 180;
              const y1 = srcNode.position.y + 35;
              const x2 = tgtNode.position.x;
              const y2 = tgtNode.position.y + 35;

              const dx = Math.abs(x2 - x1) / 2;
              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <path
                  key={e.id}
                  d={pathD}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeDasharray="5,5"
                />
              );
            })}
          </svg>

          {/* Węzły Canvas (Nodes) */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            let bgColor = "var(--panel)";
            let borderColor = "var(--line)";
            let icon = <Layers size={14} />;

            if (node.type === "trigger") {
              borderColor = "var(--accent)";
              icon = <Sparkles size={14} style={{ color: "var(--accent)" }} />;
            } else if (node.type === "prompt_component") {
              borderColor = "#8b5cf6";
              icon = <FileCode size={14} style={{ color: "#8b5cf6" }} />;
            } else if (node.type === "price_source") {
              borderColor = "#10b981";
              icon = <DollarSign size={14} style={{ color: "#10b981" }} />;
            } else if (node.type === "output_format") {
              borderColor = "#f59e0b";
              icon = <CheckCircle size={14} style={{ color: "#f59e0b" }} />;
            }

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleCanvasMouseDown(node.id, e)}
                style={{
                  position: "absolute",
                  left: node.position.x,
                  top: node.position.y,
                  width: 180,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: bgColor,
                  border: `2px solid ${isSelected ? "var(--accent)" : borderColor}`,
                  boxShadow: isSelected ? "0 0 0 3px var(--accent-soft)" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  cursor: "grab",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {icon}
                    <span className="up mute" style={{ fontSize: 9, fontWeight: 700 }}>
                      {node.type.toUpperCase()}
                    </span>
                  </div>
                  {node.type !== "trigger" && node.type !== "output_format" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.id);
                      }}
                      style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer", padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2 }}>
                  {node.data.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel boczny konfiguracyjny wybranego węzła */}
        <div className="panel" style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            {selectedNode ? `Konfiguracja Węzła: ${selectedNode.data.label}` : "Wybierz węzeł na płótnie"}
          </h4>

          {selectedNode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 2 }}>
                  Etykieta Węzła
                </label>
                <input
                  type="text"
                  className="panel"
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)" }}
                  value={selectedNode.data.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNodes((prev) =>
                      prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: val } } : n))
                    );
                  }}
                />
              </div>

              {selectedNode.type === "prompt_component" && (
                <div>
                  <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 2 }}>
                    Podepnij Komponent Wytycznych
                  </label>
                  <select
                    className="panel"
                    style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)" }}
                    value={selectedNode.data.componentId ?? ""}
                    onChange={(e) => {
                      const val = (e.target.value as Id<"aiPromptComponents">) || undefined;
                      const matched = promptComponents.find((c: any) => c._id === val);
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === selectedNode.id
                            ? {
                                ...n,
                                data: {
                                  ...n.data,
                                  componentId: val,
                                  label: matched ? `Wytyczne: ${matched.title}` : n.data.label,
                                },
                              }
                            : n
                        )
                      );
                    }}
                  >
                    <option value="">-- Wybierz z biblioteki --</option>
                    {promptComponents.map((comp: any) => (
                      <option key={comp._id} value={comp._id}>
                        {comp.title} ({comp.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.type === "price_source" && (
                <div>
                  <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 4 }}>
                    Dołączone Cenniki Convex
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {PRICE_TABLE_OPTIONS.map((pt) => {
                      const isChecked = selectedNode.data.priceTables?.includes(pt.id);
                      return (
                        <label key={pt.id} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentTables = selectedNode.data.priceTables ?? [];
                              const updated = e.target.checked
                                ? [...currentTables, pt.id]
                                : currentTables.filter((t) => t !== pt.id);

                              setNodes((prev) =>
                                prev.map((n) =>
                                  n.id === selectedNode.id ? { ...n, data: { ...n.data, priceTables: updated } } : n
                                )
                              );
                            }}
                          />
                          {pt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="up mute" style={{ fontSize: 10, display: "block", marginBottom: 2 }}>
                  Dodatkowa Dedykowana Instrukcja dla AI
                </label>
                <textarea
                  className="panel"
                  rows={4}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", resize: "vertical" }}
                  value={selectedNode.data.customText ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNodes((prev) =>
                      prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, customText: val } } : n))
                    );
                  }}
                  placeholder="Wpisz specyficzne instrukcje krokowe..."
                />
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-mute)", margin: 0 }}>
              Kliknij na dowolny węzeł na płótnie po lewej stronie, aby skonfigurować jego wytyczne, podpięty cennik lub tekst instrukcji.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
