"use client";

import { useState, useEffect, useRef } from "react";
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
  Sparkles,
  GitFork,
  Package,
  ChevronDown,
  ChevronRight,
  Search,
  HelpCircle,
  ShieldAlert,
  Percent,
  PlusCircle,
  ListChecks,
  Edit3,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType =
  | "trigger"
  | "prompt_component"
  | "price_source"
  | "output_format"
  | "condition"
  | "data_transform"
  | "data_fetch"
  | "notification"
  | "package_builder"
  | "input_required"
  | "condition_branch"
  | "discount_rule"
  | "price_modifier"
  | "validation_gate"
  | "question_step";

export type WorkflowNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    componentId?: Id<"aiPromptComponents">;
    priceTables?: string[];
    customText?: string;
    conditionExpr?: string;
    notificationTarget?: string;

    // Wymagane pola (input_required)
    requiredFields?: string[];
    inputPrompt?: string;

    // Warunki logiczne (condition_branch)
    conditionVariable?: string;
    conditionOperator?: string;
    conditionValue?: string;
    componentIdTrue?: Id<"aiPromptComponents">;
    componentIdFalse?: Id<"aiPromptComponents">;

    // Reguły rabatowe (discount_rule)
    discountConditionType?: string;
    discountThreshold?: number;
    discountPercent?: number;

    // Dopłaty / modyfikatory (price_modifier)
    modifierName?: string;
    modifierType?: "percent" | "fixed";
    modifierValue?: number;
    modifierCategory?: "service" | "installation" | "extras";

    // Bramka walidacyjna (validation_gate)
    validationMinWidth?: number;
    validationMaxWidth?: number;
    validationMinLength?: number;
    validationMaxLength?: number;
    validationErrorMessage?: string;

    // Krok pytający (question_step)
    questionText?: string;
    questionType?: string;
    questionOptions?: string[];
    questionVariable?: string;
  };
};

export type WorkflowEdge = { id: string; source: string; target: string };

type PromptComponentItem = {
  _id: Id<"aiPromptComponents">;
  title: string;
  category: "guidelines" | "pricing_rules" | "output_format" | "questions" | "validation" | "context";
  content: string;
  updatedAt: number;
};

// ─── Palette & constants ──────────────────────────────────────────────────────

const NODE_PALETTE: {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  defaultLabel: string;
}[] = [
  // Wymogi i Pytania
  { type: "input_required",   label: "Wymagane Dane",   icon: <ListChecks size={13} />,     color: "#ec4899", category: "Wymogi i Pytania", defaultLabel: "Wymagane Dane Wejściowe" },
  { type: "question_step",    label: "Krok Pytający",   icon: <HelpCircle size={13} />,     color: "#3b82f6", category: "Wymogi i Pytania", defaultLabel: "Pytanie Doprecyzowujące" },
  
  // Logika i Walidacja
  { type: "condition_branch", label: "Warunek If/Else", icon: <GitFork size={13} />,        color: "#ef4444", category: "Logika i Walidacja", defaultLabel: "Warunek Logiczny (If/Else)" },
  { type: "validation_gate",  label: "Bramka Walidacji",icon: <ShieldAlert size={13} />,    color: "#f97316", category: "Logika i Walidacja", defaultLabel: "Walidacja Wymiarów" },
  
  // Cenniki i Rabaty
  { type: "discount_rule",    label: "Reguła Rabatu",   icon: <Percent size={13} />,        color: "#84cc16", category: "Cenniki i Rabaty",  defaultLabel: "Reguła Rabatu Automatycznego" },
  { type: "price_modifier",   label: "Dopłata / Modyf.",icon: <PlusCircle size={13} />,     color: "#10b981", category: "Cenniki i Rabaty",  defaultLabel: "Dopłata Cenowa / Modyfikator" },
  { type: "price_source",     label: "Cennik Bazowy",   icon: <DollarSign size={13} />,     color: "#06b6d4", category: "Cenniki i Rabaty",  defaultLabel: "Podpięty Cennik" },

  // Wytyczne i Wyjście
  { type: "prompt_component", label: "Wytyczne AI",     icon: <FileCode size={13} />,       color: "#8b5cf6", category: "Wytyczne AI",       defaultLabel: "Komponent Wytycznych" },
  { type: "package_builder",  label: "Pakiet Wyceny",   icon: <Package size={13} />,        color: "#a855f7", category: "Wytyczne AI",       defaultLabel: "Konfiguracja Pakietu" },
  { type: "output_format",    label: "Format Wyjścia",  icon: <CheckCircle size={13} />,    color: "#f59e0b", category: "Wytyczne AI",       defaultLabel: "Format Wyjścia JSON" },
];

const STANDARD_INPUT_FIELDS = [
  { id: "widthCm", label: "Szerokość (cm)" },
  { id: "lengthCm", label: "Długość (cm)" },
  { id: "material", label: "Materiał dachu (poliwęglan/szkło)" },
  { id: "sideWalls", label: "Ściany boczne (tak/nie)" },
  { id: "installationNeeded", label: "Wymóg montażu" },
  { id: "city", label: "Miasto / Kod pocztowy" },
  { id: "clientType", label: "Typ klienta (B2C / B2B)" },
];

const PRICE_TABLE_OPTIONS = [
  { id: "polycarbonate",  label: "Dach z Poliwęglanu" },
  { id: "glass",          label: "Dach ze Szkła" },
  { id: "sliding_walls",  label: "Ściany Przesuwne Szklane" },
  { id: "fixed_walls",    label: "Ściany Stałe Poliwęglan" },
  { id: "extras",         label: "Trójkąty Boczne i Dodatki" },
  { id: "installation",   label: "Stawki Montażowe" },
];

const SERVICE_OPTIONS = ["Zabudowa tarasu", "Zadaszenie tarasu", "Ściany szklane", "General"];

const COMP_CAT_COLORS: Record<string, string> = {
  guidelines:    "#8b5cf6",
  pricing_rules: "#10b981",
  output_format: "#f59e0b",
  questions:     "#3b82f6",
  validation:    "#ef4444",
  context:       "#06b6d4",
};

const COMP_CAT_LABELS: Record<string, string> = {
  guidelines:    "Wytyczne",
  pricing_rules: "Ceny",
  output_format: "Output",
  questions:     "Pytania",
  validation:    "Walidacja",
  context:       "Kontekst",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNodeMeta(type: NodeType): { color: string; icon: React.ReactNode } {
  if (type === "trigger") return { color: "#4ABBC3", icon: <Sparkles size={14} style={{ color: "#4ABBC3" }} /> };
  const p = NODE_PALETTE.find((n) => n.type === type);
  return p
    ? { color: p.color, icon: <span style={{ color: p.color }}>{p.icon}</span> }
    : { color: "var(--line)", icon: null };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowCanvas() {
  const workflows       = useQuery(api.aiWorkflows.listWorkflows)       ?? [];
  const promptComponents = useQuery(api.aiWorkflows.listPromptComponents) ?? [];
  const saveDraft       = useMutation(api.aiWorkflows.saveWorkflowDraft);
  const activateWf      = useMutation(api.aiWorkflows.activateWorkflow);
  const upsertComponent = useMutation(api.aiWorkflows.upsertPromptComponent);
  const deleteComponent = useMutation(api.aiWorkflows.deletePromptComponent);

  // ── Workflow state ──
  const [selectedWfId, setSelectedWfId] = useState<Id<"aiWorkflows"> | null>(null);
  const [serviceType,  setServiceType]  = useState("Zabudowa tarasu");
  const [title,        setTitle]        = useState("Workflow Wyceny Tarasów");
  const [description,  setDescription]  = useState("");

  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: "node-1", type: "trigger",        position: { x: 50,  y: 140 }, data: { label: "Wyzwolenie: Zapytanie o Taras" } },
    { id: "node-2", type: "input_required", position: { x: 300, y: 60  }, data: { label: "Wymagane dane zadaszenia", requiredFields: ["widthCm", "lengthCm", "material"], inputPrompt: "Upewnij się że podano wymiary i materiał" } },
    { id: "node-3", type: "condition_branch",position: { x: 560, y: 60  }, data: { label: "Typ Klienta (B2B vs B2C)", conditionVariable: "clientType", conditionOperator: "==", conditionValue: "business" } },
    { id: "node-4", type: "price_source",   position: { x: 830, y: 60  }, data: { label: "Cenniki Tarasów i Ścian", priceTables: ["polycarbonate", "glass", "sliding_walls", "installation"] } },
    { id: "node-5", type: "discount_rule",  position: { x: 560, y: 220 }, data: { label: "Rabat dla dużych zamówień", discountConditionType: "net_total", discountThreshold: 20000, discountPercent: 5 } },
    { id: "node-6", type: "output_format",  position: { x: 830, y: 220 }, data: { label: "Karta Wyceny JSON + Odpowiedź" } },
  ]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([
    { id: "e1-2", source: "node-1", target: "node-2" },
    { id: "e2-3", source: "node-2", target: "node-3" },
    { id: "e3-4", source: "node-3", target: "node-4" },
    { id: "e4-5", source: "node-4", target: "node-5" },
    { id: "e5-6", source: "node-5", target: "node-6" },
  ]);

  // ── Canvas drag state ──
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNodeId,  setDraggedNodeId]  = useState<string | null>(null);
  const [dragOffset,     setDragOffset]     = useState({ x: 0, y: 0 });

  // ── UI state ──
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Library & Component Editing state ──
  const [compSearch,        setCompSearch]        = useState("");
  const [compFilter,        setCompFilter]        = useState<string>("all");
  const [expandedCompId,    setExpandedCompId]    = useState<string | null>(null);
  const [showAddComponent,  setShowAddComponent]  = useState(false);
  const [newCompTitle,      setNewCompTitle]      = useState("");
  const [newCompCategory,   setNewCompCategory]   = useState("guidelines");
  const [newCompContent,    setNewCompContent]    = useState("");

  // Edit existing component state
  const [editingCompId,    setEditingCompId]    = useState<Id<"aiPromptComponents"> | null>(null);
  const [editCompTitle,    setEditCompTitle]    = useState("");
  const [editCompCategory, setEditCompCategory] = useState<PromptComponentItem["category"]>("guidelines");
  const [editCompContent,  setEditCompContent]  = useState("");

  const currentWf = (workflows as Array<{ _id: Id<"aiWorkflows">; serviceType: string; title: string; description?: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }>).find((w) => w._id === selectedWfId);

  useEffect(() => {
    if (currentWf) {
      queueMicrotask(() => {
        setServiceType(currentWf.serviceType);
        setTitle(currentWf.title);
        setDescription(currentWf.description ?? "");
        setNodes(currentWf.nodes as WorkflowNode[]);
        setEdges(currentWf.edges as WorkflowEdge[]);
      });
    }
  }, [selectedWfId, currentWf]);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Canvas handlers ───────────────────────────────────────────────────────

  const handleCanvasMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNodeId(nodeId);

    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mouseXInCanvas = e.clientX - r.left;
    const mouseYInCanvas = e.clientY - r.top;

    const n = nodes.find((n) => n.id === nodeId);
    if (n) {
      setDragOffset({
        x: mouseXInCanvas - n.position.x,
        y: mouseYInCanvas - n.position.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mouseXInCanvas = e.clientX - r.left;
    const mouseYInCanvas = e.clientY - r.top;

    const x = Math.max(10, Math.min(r.width - 220, mouseXInCanvas - dragOffset.x));
    const y = Math.max(10, Math.min(r.height - 100, mouseYInCanvas - dragOffset.y));

    setNodes((prev) =>
      prev.map((n) => (n.id === draggedNodeId ? { ...n, position: { x, y } } : n))
    );
  };

  const handleCanvasMouseUp = () => setDraggedNodeId(null);

  // ── Node CRUD ─────────────────────────────────────────────────────────────

  const handleAddNode = (type: NodeType) => {
    const p = NODE_PALETTE.find((n) => n.type === type);
    const newId = `node-${nodes.length + 1}`;
    const newNode: WorkflowNode = {
      id: newId,
      type,
      position: { x: 180 + (nodes.length % 4) * 50, y: 100 + (nodes.length % 3) * 70 },
      data: { label: p?.defaultLabel ?? "Nowy Krok" },
    };
    const last = nodes[nodes.length - 1];
    setNodes((prev) => [...prev, newNode]);
    if (last) setEdges((prev) => [...prev, { id: `e-${last.id}-${newId}`, source: last.id, target: newId }]);
    setSelectedNodeId(newId);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const updateNode = (nodeId: string, patch: Partial<WorkflowNode["data"]>) =>
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));

  // ── Workflow save / activate ──────────────────────────────────────────────

  const showStatus = (type: "success" | "error", text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleSaveDraft = async () => {
    try {
      const id = await saveDraft({ id: selectedWfId ?? undefined, serviceType, title, description, nodes, edges });
      setSelectedWfId(id);
      showStatus("success", "Zapisano wersję roboczą workflowu.");
    } catch (err) {
      showStatus("error", `Błąd zapisu: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  };

  const handleActivate = async () => {
    if (!selectedWfId) { alert("Najpierw zapisz wersję roboczą."); return; }
    try {
      await activateWf({ id: selectedWfId });
      showStatus("success", "Workflow opublikowany na produkcję!");
    } catch (err) {
      showStatus("error", `Błąd publikacji: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  };

  // ── Component CRUD & Editing ──────────────────────────────────────────────

  const handleSaveNewComponent = async () => {
    if (!newCompTitle.trim() || !newCompContent.trim()) return;
    try {
      const newId = await upsertComponent({
        title: newCompTitle.trim(),
        category: newCompCategory as PromptComponentItem["category"],
        content: newCompContent.trim(),
      });
      setNewCompTitle("");
      setNewCompContent("");
      setShowAddComponent(false);
      
      // Auto-attach if a node is currently selected and needs a component
      if (selectedNode && ["prompt_component", "condition_branch"].includes(selectedNode.type)) {
        updateNode(selectedNode.id, { componentId: newId, label: `Wytyczne: ${newCompTitle.trim()}` });
      }

      showStatus("success", "Dodano i podpięto nowy komponent wytycznych.");
    } catch (err) {
      showStatus("error", `Błąd zapisu komponentu: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  };

  const handleStartEditComponent = (comp: PromptComponentItem) => {
    setEditingCompId(comp._id);
    setEditCompTitle(comp.title);
    setEditCompCategory(comp.category);
    setEditCompContent(comp.content);
  };

  const handleSaveEditComponent = async () => {
    if (!editingCompId || !editCompTitle.trim() || !editCompContent.trim()) return;
    try {
      await upsertComponent({
        id: editingCompId,
        title: editCompTitle.trim(),
        category: editCompCategory,
        content: editCompContent.trim(),
      });
      setEditingCompId(null);
      showStatus("success", "Zaktualizowano treść komponentu w bazie.");
    } catch (err) {
      showStatus("error", `Błąd aktualizacji: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  };

  const handleDeleteComponent = async (id: Id<"aiPromptComponents">) => {
    if (!confirm("Czy na pewno chcesz usunąć ten komponent?")) return;
    try {
      await deleteComponent({ id });
      showStatus("success", "Komponent usunięty.");
    } catch (err) {
      showStatus("error", `Błąd usuwania: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  };

  const filteredComponents = (promptComponents as PromptComponentItem[]).filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(compSearch.toLowerCase()) || c.content.toLowerCase().includes(compSearch.toLowerCase());
    const matchFilter = compFilter === "all" || c.category === compFilter;
    return matchSearch && matchFilter;
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const canAttachToSelected = selectedNode && ["prompt_component", "condition_branch"].includes(selectedNode.type);

  // Helper to render attached component editor inside inspector
  const renderAttachedComponentEditor = (compId?: Id<"aiPromptComponents">, labelText = "Podpięty Komponent Wytycznych") => {
    if (!compId) return null;
    const comp = (promptComponents as PromptComponentItem[]).find((c) => c._id === compId);
    if (!comp) return null;

    const isEditingThis = editingCompId === comp._id;

    return (
      <div style={{ marginTop: 6, padding: 8, borderRadius: 6, backgroundColor: "var(--panel)", border: "1px solid var(--accent-line)", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>
            📄 {labelText}: {comp.title}
          </span>
          <button
            onClick={() => isEditingThis ? setEditingCompId(null) : handleStartEditComponent(comp)}
            style={{ border: "none", background: "transparent", color: "var(--accent)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}
          >
            {isEditingThis ? <X size={11} /> : <Edit3 size={11} />} {isEditingThis ? "Zamknij" : "Edytuj treść"}
          </button>
        </div>

        {isEditingThis ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 4 }}>
            <input
              type="text" className="panel" placeholder="Nazwa..."
              value={editCompTitle} onChange={(e) => setEditCompTitle(e.target.value)}
              style={{ width: "100%", padding: "4px 6px", fontSize: 11, borderRadius: 4, border: "1px solid var(--line)" }}
            />
            <textarea
              className="panel" rows={4} placeholder="Treść instrukcji dla AI..."
              value={editCompContent} onChange={(e) => setEditCompContent(e.target.value)}
              style={{ width: "100%", padding: "4px 6px", fontSize: 11, borderRadius: 4, border: "1px solid var(--line)", resize: "vertical", fontFamily: "monospace" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
              <button className="btn primary" onClick={handleSaveEditComponent} style={{ padding: "3px 8px", fontSize: 10, gap: 3 }}>
                <Save size={10} /> Zapisz treść w bazie
              </button>
            </div>
          </div>
        ) : (
          <pre style={{ fontSize: 10, margin: 0, whiteSpace: "pre-wrap", color: "var(--text-dim)", fontFamily: "monospace", backgroundColor: "var(--panel-2)", padding: 6, borderRadius: 4, maxHeight: 90, overflowY: "auto" }}>
            {comp.content}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", backgroundColor: "var(--panel-2)", overflow: "hidden" }}>

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, padding: "0 16px", borderBottom: "1px solid var(--line)",
        backgroundColor: "var(--panel)", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={selectedWfId ?? ""} onChange={(e) => setSelectedWfId(e.target.value ? (e.target.value as Id<"aiWorkflows">) : null)}
            style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid var(--line)", backgroundColor: "var(--panel-2)" }}>
            <option value="">-- Nowy Workflow (Roboczy) --</option>
            {(workflows as Array<{ _id: Id<"aiWorkflows">; title: string; serviceType: string; status: string }>).map((w) => (
              <option key={w._id} value={w._id}>
                {w.title} ({w.serviceType}) — {w.status === "active" ? "🟢 Aktywny" : "⚪ Draft"}
              </option>
            ))}
          </select>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nazwa workflowu..."
            style={{ padding: "4px 8px", fontSize: 13, fontWeight: 700, borderRadius: 6, border: "1px solid var(--line)", width: 220 }} />
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
            style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
            {SERVICE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {statusMsg && (
            <span style={{ fontSize: 11, fontWeight: 600, color: statusMsg.type === "success" ? "var(--ok)" : "var(--bad)", marginRight: 4 }}>
              {statusMsg.text}
            </span>
          )}
          <button className="btn" onClick={handleSaveDraft} style={{ gap: 5, padding: "5px 12px", fontSize: 12 }}>
            <Save size={13} /> Zapisz Draft
          </button>
          <button className="btn primary" onClick={handleActivate} style={{ gap: 5, padding: "5px 14px", fontSize: 12 }}>
            <Play size={13} /> Aktywuj (Produkcja)
          </button>
        </div>
      </div>

      {/* ── Main Workspace ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Canvas Area ── */}
        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={() => setSelectedNodeId(null)}
          style={{
            flex: 1, height: "100%", position: "relative", overflow: "hidden",
            backgroundImage: "radial-gradient(circle, var(--line) 1px, transparent 1px)",
            backgroundSize: "20px 20px", cursor: draggedNodeId ? "grabbing" : "default",
          }}
        >
          {/* SVG Edges */}
          <svg style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            {edges.map((e) => {
              const src = nodes.find((n) => n.id === e.source);
              const tgt = nodes.find((n) => n.id === e.target);
              if (!src || !tgt) return null;
              const x1 = src.position.x + 200;
              const y1 = src.position.y + 40;
              const x2 = tgt.position.x;
              const y2 = tgt.position.y + 40;
              const dx = Math.abs(x2 - x1) * 0.5;
              const pathStr = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              return (
                <g key={e.id}>
                  <path d={pathStr} fill="none" stroke="var(--line-2)" strokeWidth="3" />
                  <path d={pathStr} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5,5" />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const meta = getNodeMeta(node.type);
            const isSelected = selectedNodeId === node.id;
            const attachedComp = node.data.componentId
              ? (promptComponents as PromptComponentItem[]).find((c) => c._id === node.data.componentId)
              : null;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleCanvasMouseDown(node.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
                style={{
                  position: "absolute", left: node.position.x, top: node.position.y,
                  width: 210, backgroundColor: "var(--panel)", borderRadius: 10,
                  border: isSelected ? `2px solid ${meta.color}` : "1px solid var(--line)",
                  boxShadow: isSelected ? `0 0 0 3px ${meta.color}25, 0 4px 12px rgba(0,0,0,0.1)` : "0 2px 6px rgba(0,0,0,0.05)",
                  cursor: "grab", userSelect: "none", transition: "border 0.15s, box-shadow 0.15s", zIndex: isSelected ? 10 : 2,
                }}
              >
                {/* Node Header */}
                <div style={{
                  padding: "8px 10px", borderBottom: "1px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  backgroundColor: `${meta.color}10`, borderTopLeftRadius: 8, borderTopRightRadius: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {meta.icon}
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {node.type}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                    style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer", padding: 2, opacity: 0.6, lineHeight: 1 }}
                    title="Usuń krok z workflowu"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Node Body */}
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                    {node.data.label}
                  </div>

                  {/* Rich Node Details */}
                  {node.type === "input_required" && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)", display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {(node.data.requiredFields || []).map((f) => (
                        <span key={f} style={{ backgroundColor: "#ec489918", color: "#ec4899", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {node.type === "condition_branch" && (
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace", backgroundColor: "#ef444410", padding: "3px 6px", borderRadius: 4 }}>
                      If ({node.data.conditionVariable || "zmienna"} {node.data.conditionOperator || "=="} {`"${node.data.conditionValue || ""}"`})
                    </div>
                  )}

                  {node.type === "validation_gate" && (
                    <div style={{ fontSize: 10, color: "#f97316", fontWeight: 600 }}>
                      Szer: {node.data.validationMinWidth ?? 0}–{node.data.validationMaxWidth ?? "∞"}cm | Dł: {node.data.validationMinLength ?? 0}–{node.data.validationMaxLength ?? "∞"}cm
                    </div>
                  )}

                  {node.type === "discount_rule" && (
                    <div style={{ fontSize: 10, color: "#84cc16", fontWeight: 600 }}>
                      Próg: ≥{node.data.discountThreshold ?? 0}zł → Rabat: {node.data.discountPercent ?? 0}%
                    </div>
                  )}

                  {node.type === "price_modifier" && (
                    <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>
                      {node.data.modifierName || "Dopłata"}: {node.data.modifierType === "percent" ? `+${node.data.modifierValue}%` : `+${node.data.modifierValue} zł`}
                    </div>
                  )}

                  {node.type === "question_step" && (
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>
                      {`"${node.data.questionText || "Pytanie..."}"`}
                    </div>
                  )}

                  {attachedComp && (
                    <div style={{ fontSize: 10, color: "#8b5cf6", backgroundColor: "#8b5cf612", padding: "2px 5px", borderRadius: 4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📄 {attachedComp.title}
                    </div>
                  )}

                  {node.data.priceTables && node.data.priceTables.length > 0 && (
                    <div style={{ fontSize: 10, color: "#06b6d4", fontWeight: 600 }}>
                      📊 Podpięte cenniki: {node.data.priceTables.length}
                    </div>
                  )}
                </div>

                {/* Ports */}
                <div style={{ position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", backgroundColor: meta.color, border: "2px solid var(--panel)" }} />
                <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", backgroundColor: meta.color, border: "2px solid var(--panel)" }} />
              </div>
            );
          })}
        </div>

        {/* ── Right Panel (Combined Node Inspector + Component Library) ───────── */}
        <div style={{
          width: 360, height: "100%", borderLeft: "1px solid var(--line)",
          backgroundColor: "var(--panel)", display: "flex", flexDirection: "column",
          flexShrink: 0, overflow: "hidden",
        }}>

          {/* ── Node Inspector ── */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0, backgroundColor: "var(--panel-2)", maxHeight: "55%", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sliders size={13} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Konfiguracja węzła
                </span>
              </div>
              {selectedNode && (
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  style={{ border: "none", background: "transparent", color: "var(--bad)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}
                >
                  <Trash2 size={11} /> Usuń
                </button>
              )}
            </div>

            {selectedNode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Node Label */}
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Etykieta kroku</label>
                  <input
                    type="text" className="panel"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)" }}
                    value={selectedNode.data.label}
                    onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                  />
                </div>

                {/* ── Attached Component Picker & Editor for prompt_component ── */}
                {selectedNode.type === "prompt_component" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="up mute" style={{ fontSize: 9 }}>Podpięty komponent wytycznych z bazy</label>
                    <select
                      className="panel"
                      value={selectedNode.data.componentId || ""}
                      onChange={(e) => {
                        const cid = e.target.value ? (e.target.value as Id<"aiPromptComponents">) : undefined;
                        const comp = (promptComponents as PromptComponentItem[]).find((c) => c._id === cid);
                        updateNode(selectedNode.id, { componentId: cid, label: comp ? `Wytyczne: ${comp.title}` : selectedNode.data.label });
                      }}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    >
                      <option value="">-- Wybierz komponent --</option>
                      {(promptComponents as PromptComponentItem[]).map((c) => (
                        <option key={c._id} value={c._id}>📄 {c.title}</option>
                      ))}
                    </select>

                    {renderAttachedComponentEditor(selectedNode.data.componentId, "Wytyczne")}

                    {!selectedNode.data.componentId && (
                      <button
                        className="btn primary"
                        onClick={() => setShowAddComponent(true)}
                        style={{ padding: "4px 8px", fontSize: 10, gap: 4, width: "100%", marginTop: 4 }}
                      >
                        <Plus size={11} /> Stwórz i podepnij nowy komponent
                      </button>
                    )}
                  </div>
                )}

                {/* ── Input Required Editor ── */}
                {selectedNode.type === "input_required" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="up mute" style={{ fontSize: 9 }}>Wymagane pola do wyceny</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {STANDARD_INPUT_FIELDS.map((f) => {
                        const isChecked = (selectedNode.data.requiredFields || []).includes(f.id);
                        return (
                          <label key={f.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const curr = selectedNode.data.requiredFields || [];
                                updateNode(selectedNode.id, {
                                  requiredFields: e.target.checked ? [...curr, f.id] : curr.filter((x) => x !== f.id),
                                });
                              }}
                            />
                            {f.label}
                          </label>
                        );
                      })}
                    </div>
                    <label className="up mute" style={{ fontSize: 9, marginTop: 4 }}>Dedykowane pytanie/instrukcja AI</label>
                    <input
                      type="text" className="panel" placeholder="np. Podaj długość i szerokość dachu w cm..."
                      value={selectedNode.data.inputPrompt || ""}
                      onChange={(e) => updateNode(selectedNode.id, { inputPrompt: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                )}

                {/* ── Condition Branch Editor ── */}
                {selectedNode.type === "condition_branch" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="up mute" style={{ fontSize: 9 }}>Zmienna warunku</label>
                    <input
                      type="text" className="panel" placeholder="np. clientType, totalAreaM2, material"
                      value={selectedNode.data.conditionVariable || ""}
                      onChange={(e) => updateNode(selectedNode.id, { conditionVariable: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Operator</label>
                        <select
                          className="panel"
                          value={selectedNode.data.conditionOperator || "=="}
                          onChange={(e) => updateNode(selectedNode.id, { conditionOperator: e.target.value })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        >
                          <option value="==">== (Równe)</option>
                          <option value=">">&gt; (Większe)</option>
                          <option value="<">&lt; (Mniejsze)</option>
                          <option value=">=">&gt;= (Większe/Równe)</option>
                          <option value="<=">&lt;= (Mniejsze/Równe)</option>
                          <option value="!=">!= (Różne)</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Wartość porównania</label>
                        <input
                          type="text" className="panel" placeholder="np. business, 25"
                          value={selectedNode.data.conditionValue || ""}
                          onChange={(e) => updateNode(selectedNode.id, { conditionValue: e.target.value })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>

                    <label className="up mute" style={{ fontSize: 9, marginTop: 4 }}>Wytyczne przy SPEŁNIONYM warunku (TAK)</label>
                    <select
                      className="panel"
                      value={selectedNode.data.componentIdTrue || ""}
                      onChange={(e) => updateNode(selectedNode.id, { componentIdTrue: e.target.value ? (e.target.value as Id<"aiPromptComponents">) : undefined })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    >
                      <option value="">-- Wybierz komponent wytycznych (Brak) --</option>
                      {(promptComponents as PromptComponentItem[]).map((c) => (
                        <option key={c._id} value={c._id}>📄 {c.title}</option>
                      ))}
                    </select>

                    {renderAttachedComponentEditor(selectedNode.data.componentIdTrue, "TAK")}

                    <label className="up mute" style={{ fontSize: 9, marginTop: 4 }}>Wytyczne przy NIESPEŁNIONYM warunku (NIE)</label>
                    <select
                      className="panel"
                      value={selectedNode.data.componentIdFalse || ""}
                      onChange={(e) => updateNode(selectedNode.id, { componentIdFalse: e.target.value ? (e.target.value as Id<"aiPromptComponents">) : undefined })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    >
                      <option value="">-- Wybierz komponent wytycznych (Brak) --</option>
                      {(promptComponents as PromptComponentItem[]).map((c) => (
                        <option key={c._id} value={c._id}>📄 {c.title}</option>
                      ))}
                    </select>

                    {renderAttachedComponentEditor(selectedNode.data.componentIdFalse, "NIE")}
                  </div>
                )}

                {/* ── Validation Gate Editor ── */}
                {selectedNode.type === "validation_gate" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Szerokość Min (cm)</label>
                        <input
                          type="number" className="panel" placeholder="300"
                          value={selectedNode.data.validationMinWidth ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { validationMinWidth: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Szerokość Max (cm)</label>
                        <input
                          type="number" className="panel" placeholder="400"
                          value={selectedNode.data.validationMaxWidth ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { validationMaxWidth: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Długość Min (cm)</label>
                        <input
                          type="number" className="panel" placeholder="306"
                          value={selectedNode.data.validationMinLength ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { validationMinLength: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Długość Max (cm)</label>
                        <input
                          type="number" className="panel" placeholder="1206"
                          value={selectedNode.data.validationMaxLength ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { validationMaxLength: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>
                    <label className="up mute" style={{ fontSize: 9, marginTop: 2 }}>Komunikat błędu walidacji</label>
                    <input
                      type="text" className="panel" placeholder="Wymiar niestandardowy - wycena indywidualna"
                      value={selectedNode.data.validationErrorMessage || ""}
                      onChange={(e) => updateNode(selectedNode.id, { validationErrorMessage: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                )}

                {/* ── Discount Rule Editor ── */}
                {selectedNode.type === "discount_rule" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="up mute" style={{ fontSize: 9 }}>Kryterium przyznania rabatu</label>
                    <select
                      className="panel"
                      value={selectedNode.data.discountConditionType || "net_total"}
                      onChange={(e) => updateNode(selectedNode.id, { discountConditionType: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    >
                      <option value="net_total">Suma netto wyceny (zł)</option>
                      <option value="area_m2">Powierzchnia tarasu (m²)</option>
                    </select>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Próg aktywacji</label>
                        <input
                          type="number" className="panel" placeholder="15000"
                          value={selectedNode.data.discountThreshold ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { discountThreshold: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Wysokość rabatu (%)</label>
                        <input
                          type="number" className="panel" placeholder="5"
                          value={selectedNode.data.discountPercent ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { discountPercent: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Price Modifier Editor ── */}
                {selectedNode.type === "price_modifier" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="up mute" style={{ fontSize: 9 }}>Nazwa dopłaty / modyfikatora</label>
                    <input
                      type="text" className="panel" placeholder="np. Kolor Niestandardowy RAL"
                      value={selectedNode.data.modifierName || ""}
                      onChange={(e) => updateNode(selectedNode.id, { modifierName: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Typ modyfikatora</label>
                        <select
                          className="panel"
                          value={selectedNode.data.modifierType || "percent"}
                          onChange={(e) => updateNode(selectedNode.id, { modifierType: e.target.value as "percent" | "fixed" })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        >
                          <option value="percent">% Procentowo</option>
                          <option value="fixed">zł Kwotowo</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="up mute" style={{ fontSize: 9 }}>Wartość</label>
                        <input
                          type="number" className="panel" placeholder="15"
                          value={selectedNode.data.modifierValue ?? ""}
                          onChange={(e) => updateNode(selectedNode.id, { modifierValue: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                        />
                      </div>
                    </div>
                    <label className="up mute" style={{ fontSize: 9 }}>Kategoria w karcie wyceny</label>
                    <select
                      className="panel"
                      value={selectedNode.data.modifierCategory || "extras"}
                      onChange={(e) => updateNode(selectedNode.id, { modifierCategory: e.target.value as "service" | "installation" | "extras" })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    >
                      <option value="service">Usługa (service)</option>
                      <option value="installation">Montaż (installation)</option>
                      <option value="extras">Dodatki (extras)</option>
                    </select>
                  </div>
                )}

                {/* ── Question Step Editor ── */}
                {selectedNode.type === "question_step" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="up mute" style={{ fontSize: 9 }}>Treść pytania do klienta</label>
                    <input
                      type="text" className="panel" placeholder="np. Czy taras posiada wylewkę betonową?"
                      value={selectedNode.data.questionText || ""}
                      onChange={(e) => updateNode(selectedNode.id, { questionText: e.target.value })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                    <label className="up mute" style={{ fontSize: 9 }}>Sugerowane opcje (oddzielone przecinkami)</label>
                    <input
                      type="text" className="panel" placeholder="Tak, Nie, W trakcie budowy"
                      value={(selectedNode.data.questionOptions || []).join(", ")}
                      onChange={(e) => updateNode(selectedNode.id, { questionOptions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                )}

                {/* ── Price Sources ── */}
                {selectedNode.type === "price_source" && (
                  <div>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 4 }}>Wybierz cenniki do załadowania dla AI</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {PRICE_TABLE_OPTIONS.map((pt) => (
                        <label key={pt.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="checkbox"
                            checked={!!selectedNode.data.priceTables?.includes(pt.id)}
                            onChange={(e) => {
                              const curr = selectedNode.data.priceTables ?? [];
                              updateNode(selectedNode.id, { priceTables: e.target.checked ? [...curr, pt.id] : curr.filter((t) => t !== pt.id) });
                            }} />
                          {pt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom text / instructions for all nodes */}
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Dodatkowe wytyczne dla kroku</label>
                  <textarea className="panel" rows={2} style={{
                    width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 6,
                    border: "1px solid var(--line)", resize: "vertical",
                  }}
                    value={selectedNode.data.customText ?? ""}
                    onChange={(e) => updateNode(selectedNode.id, { customText: e.target.value })}
                    placeholder="Wpisz specyficzne instrukcje..." />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "var(--text-mute)", margin: 0, lineHeight: 1.5 }}>
                Kliknij dowolny węzeł na płótnie, aby skonfigurować jego specyficzne warunki i parametry wyceny.
              </p>
            )}
          </div>

          {/* ── Library section ── */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

            {/* Library header */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Biblioteka komponentów
              </span>
              <button className="btn primary" onClick={() => setShowAddComponent(!showAddComponent)}
                style={{ padding: "3px 9px", borderRadius: 5, fontSize: 11, gap: 3 }}>
                <Plus size={11} /> Nowy
              </button>
            </div>

            {/* Add component form */}
            {showAddComponent && (
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
                <div style={{ backgroundColor: "var(--panel-2)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 7, border: "1px solid var(--accent-line)" }}>
                  <input type="text" className="panel" autoFocus placeholder="Nazwa komponentu..."
                    value={newCompTitle} onChange={(e) => setNewCompTitle(e.target.value)}
                    style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 5, border: "1px solid var(--line)" }} />
                  <select className="panel" value={newCompCategory} onChange={(e) => setNewCompCategory(e.target.value)}
                    style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 5, border: "1px solid var(--line)" }}>
                    <option value="guidelines">Wytyczne ogólne</option>
                    <option value="pricing_rules">Reguły wyceniania</option>
                    <option value="output_format">Format wyjścia</option>
                    <option value="questions">Pytania doprecyzowujące</option>
                    <option value="validation">Walidacja</option>
                    <option value="context">Kontekst danych</option>
                  </select>
                  <textarea className="panel" rows={3} placeholder="Treść instrukcji dla AI..."
                    value={newCompContent} onChange={(e) => setNewCompContent(e.target.value)}
                    style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 5, border: "1px solid var(--line)", resize: "vertical", fontFamily: "monospace" }} />
                  <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                    <button className="btn" onClick={() => { setShowAddComponent(false); setNewCompTitle(""); setNewCompContent(""); }}
                      style={{ padding: "4px 8px", borderRadius: 5, fontSize: 11 }}>Anuluj</button>
                    <button className="btn primary" onClick={handleSaveNewComponent}
                      style={{ padding: "4px 10px", borderRadius: 5, fontSize: 11, gap: 4 }}>
                      <Save size={11} /> Zapisz
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search + filter */}
            <div style={{ padding: "8px 10px", flexShrink: 0 }}>
              <div style={{ position: "relative", marginBottom: 6 }}>
                <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-mute)", pointerEvents: "none" }} />
                <input type="text" className="panel" placeholder="Szukaj komponentów..."
                  value={compSearch} onChange={(e) => setCompSearch(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px 5px 26px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)" }} />
              </div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {["all", "guidelines", "pricing_rules", "output_format", "questions", "validation", "context"].map((cat) => (
                  <button key={cat} onClick={() => setCompFilter(cat)} style={{
                    padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                    border: "none", cursor: "pointer", transition: "all 0.1s",
                    backgroundColor: compFilter === cat ? "var(--accent)" : "var(--panel-2)",
                    color: compFilter === cat ? "#fff" : "var(--text-mute)",
                  }}>
                    {cat === "all" ? "Wszystkie" : COMP_CAT_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Component list */}
            <div style={{ padding: "0 10px 10px", flex: 1, overflowY: "auto" }}>
              {filteredComponents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-mute)", fontSize: 12 }}>
                  {compSearch ? `Brak wyników dla "${compSearch}"` : "Brak komponentów. Dodaj pierwszy."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {filteredComponents.map((comp) => {
                    const catColor = COMP_CAT_COLORS[comp.category] ?? "var(--accent)";
                    const isExpanded = expandedCompId === comp._id;
                    const isAttached = selectedNode?.data.componentId === comp._id;
                    const isEditing = editingCompId === comp._id;

                    return (
                      <div key={comp._id} style={{
                        borderRadius: 7, border: "1px solid var(--line)", borderLeft: `3px solid ${catColor}`,
                        overflow: "hidden", backgroundColor: isAttached ? `${catColor}10` : "var(--panel)",
                      }}>
                        <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                          onClick={() => setExpandedCompId(isExpanded ? null : comp._id)}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {comp.title}
                            </div>
                            <div style={{ fontSize: 9, color: catColor, fontWeight: 600, marginTop: 1 }}>
                              {COMP_CAT_LABELS[comp.category] ?? comp.category}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                            {canAttachToSelected && (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                updateNode(selectedNode!.id, { componentId: comp._id, label: `Wytyczne: ${comp.title}` });
                              }} style={{
                                padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                                border: `1px solid ${catColor}`, cursor: "pointer", whiteSpace: "nowrap",
                                backgroundColor: isAttached ? catColor : "transparent",
                                color: isAttached ? "#fff" : catColor,
                              }}>
                                {isAttached ? "✓ Podpięty" : "Podepnij"}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isEditing) {
                                  setEditingCompId(null);
                                } else {
                                  setExpandedCompId(comp._id);
                                  handleStartEditComponent(comp);
                                }
                              }}
                              style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", padding: 2, lineHeight: 1 }}
                              title="Edytuj treść komponentu"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteComponent(comp._id); }}
                              style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer", padding: 2, opacity: 0.5, lineHeight: 1 }}>
                              <Trash2 size={10} />
                            </button>
                            {isExpanded
                              ? <ChevronDown  size={12} style={{ color: "var(--text-mute)" }} />
                              : <ChevronRight size={12} style={{ color: "var(--text-mute)" }} />}
                          </div>
                        </div>

                        {/* Expanded Content or Editor */}
                        {isExpanded && (
                          <div style={{ padding: "0 10px 8px", borderTop: "1px solid var(--line)", paddingTop: 7 }}>
                            {isEditing ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <input
                                  type="text" className="panel" placeholder="Nazwa komponentu..."
                                  value={editCompTitle} onChange={(e) => setEditCompTitle(e.target.value)}
                                  style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                                />
                                <select
                                  className="panel" value={editCompCategory} onChange={(e) => setEditCompCategory(e.target.value as PromptComponentItem["category"])}
                                  style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                                >
                                  <option value="guidelines">Wytyczne ogólne</option>
                                  <option value="pricing_rules">Reguły wyceniania</option>
                                  <option value="output_format">Format wyjścia</option>
                                  <option value="questions">Pytania doprecyzowujące</option>
                                  <option value="validation">Walidacja</option>
                                  <option value="context">Kontekst danych</option>
                                </select>
                                <textarea
                                  className="panel" rows={4} placeholder="Treść instrukcji dla AI..."
                                  value={editCompContent} onChange={(e) => setEditCompContent(e.target.value)}
                                  style={{ width: "100%", padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)", resize: "vertical", fontFamily: "monospace" }}
                                />
                                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                  <button className="btn" onClick={() => setEditingCompId(null)} style={{ padding: "3px 7px", fontSize: 10 }}>Anuluj</button>
                                  <button className="btn primary" onClick={handleSaveEditComponent} style={{ padding: "3px 9px", fontSize: 10, gap: 3 }}>
                                    <Save size={10} /> Zapisz w bazie
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <pre style={{ fontSize: 11, color: "var(--text-dim)", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", backgroundColor: "var(--panel-2)", padding: "6px 8px", borderRadius: 5, maxHeight: 140, overflowY: "auto", lineHeight: 1.5 }}>
                                  {comp.content}
                                </pre>
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
                                  <button
                                    className="btn"
                                    onClick={() => handleStartEditComponent(comp)}
                                    style={{ padding: "2px 7px", fontSize: 10, gap: 3 }}
                                  >
                                    <Edit3 size={10} /> Edytuj treść
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Node type palette ── */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                  Dodaj węzeł do workflowu
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {NODE_PALETTE.map((n) => (
                    <button key={n.type} onClick={() => handleAddNode(n.type)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 7px", borderRadius: 6,
                      border: "1px solid transparent", backgroundColor: "transparent", cursor: "pointer",
                      textAlign: "left", width: "100%", fontSize: 11, color: "var(--text)", transition: "all 0.1s",
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--panel-2)"; (e.currentTarget as HTMLElement).style.borderColor = `${n.color}30`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: `${n.color}18`, border: `1px solid ${n.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: n.color, flexShrink: 0 }}>
                        {n.icon}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, fontSize: 11 }}>{n.label}</span>
                        <span style={{ fontSize: 9, color: "var(--text-mute)" }}>{n.category}</span>
                      </div>
                      <Plus size={10} style={{ marginLeft: "auto", color: "var(--text-mute)" }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
