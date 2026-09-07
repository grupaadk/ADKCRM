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
  MessageSquare,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Hand,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType =
  | "trigger"
  | "prompt_trigger"
  | "custom_prompt"
  | "branch_splitter"
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

    // Zwykły prompt tekstowy (custom_prompt)
    promptText?: string;

    // Trigger promptu wejściowego (prompt_trigger)
    promptRole?: string;
    extractFields?: string[];
    samplePrompt?: string;

    // Rozdzielacz wątków / Rozgałęzienie (branch_splitter)
    branchName?: string;
    branchDescription?: string;
    parallelMode?: string;

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

export type WorkflowEdge = { id: string; source: string; target: string; label?: string; branchTag?: string };

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
  // Triggery i Wejście
  { type: "prompt_trigger",   label: "Prompt Wejściowy", icon: <Sparkles size={13} />,      color: "#4abbc3", category: "Triggery i Wejście", defaultLabel: "Wyzwolenie: Prompt Wejściowy" },

  // Wymogi i Pytania
  { type: "input_required",   label: "Wymagane Dane",   icon: <ListChecks size={13} />,     color: "#ec4899", category: "Wymogi i Pytania", defaultLabel: "Wymagane Dane Wejściowe" },
  { type: "question_step",    label: "Krok Pytający",   icon: <HelpCircle size={13} />,     color: "#3b82f6", category: "Wymogi i Pytania", defaultLabel: "Pytanie Doprecyzowujące" },
  
  // Logika i Walidacja
  { type: "branch_splitter",  label: "Rozdzielacz Wątków",icon: <GitFork size={13} />,       color: "#ec4899", category: "Logika i Walidacja", defaultLabel: "Rozgałęzienie: Wątek Poboczny" },
  { type: "condition_branch", label: "Warunek If/Else", icon: <GitFork size={13} />,        color: "#ef4444", category: "Logika i Walidacja", defaultLabel: "Warunek Logiczny (If/Else)" },
  { type: "validation_gate",  label: "Bramka Walidacji",icon: <ShieldAlert size={13} />,    color: "#f97316", category: "Logika i Walidacja", defaultLabel: "Walidacja Wymiarów" },
  
  // Cenniki i Rabaty
  { type: "discount_rule",    label: "Reguła Rabatu",   icon: <Percent size={13} />,        color: "#84cc16", category: "Cenniki i Rabaty",  defaultLabel: "Reguła Rabatu Automatycznego" },
  { type: "price_modifier",   label: "Dopłata / Modyf.",icon: <PlusCircle size={13} />,     color: "#10b981", category: "Cenniki i Rabaty",  defaultLabel: "Dopłata Cenowa / Modyfikator" },
  { type: "price_source",     label: "Cennik Bazowy",   icon: <DollarSign size={13} />,     color: "#06b6d4", category: "Cenniki i Rabaty",  defaultLabel: "Podpięty Cennik" },

  // Wytyczne i Wyjście
  { type: "custom_prompt",    label: "Zwykły Prompt",   icon: <MessageSquare size={13} />,  color: "#6366f1", category: "Wytyczne AI",       defaultLabel: "Zwykły Prompt Tekstowy" },
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

// ─── Presets ──────────────────────────────────────────────────────────────────

const SHOWCASE_NODES: WorkflowNode[] = [
  {
    id: "node-1-trigger",
    type: "prompt_trigger",
    position: { x: 50, y: 150 },
    data: {
      label: "1. Wyzwolenie: Zapytanie Klienta",
      promptRole: "Klient zainteresowany zadaszeniem lub zabudową tarasu",
      extractFields: ["widthCm", "lengthCm", "material", "sideWalls", "city"],
      samplePrompt: "Dzień dobry, poproszę o wycenę zadaszenia tarasu 400x300 cm z poliwęglanu we Wrocławiu.",
      customText: "Wyceniaj w oparciu o cennik standardowy ADK Okna.",
    },
  },
  {
    id: "node-2-input",
    type: "input_required",
    position: { x: 300, y: 50 },
    data: {
      label: "2. Wymagane Dane do Wyceny",
      requiredFields: ["widthCm", "lengthCm", "material", "city"],
      inputPrompt: "Upewnij się, że klient podał wymiary w cm oraz oczekiwany materiał dachu.",
    },
  },
  {
    id: "node-3-question",
    type: "question_step",
    position: { x: 550, y: 50 },
    data: {
      label: "3. Pytanie o Fundament",
      questionText: "Czy miejsce pod zadaszenie posiada wykonaną wylewkę lub stopy betonowe?",
      questionOptions: ["Tak, wylewka betonowa", "Nie, wymagane stopy", "W trakcie budowy"],
      questionVariable: "hasFoundation",
    },
  },
  {
    id: "node-4-validation",
    type: "validation_gate",
    position: { x: 800, y: 50 },
    data: {
      label: "4. Walidacja Wymiarów Dopuszczalnych",
      validationMinWidth: 200,
      validationMaxWidth: 600,
      validationMinLength: 200,
      validationMaxLength: 1200,
      validationErrorMessage: "Wymiar wykracza poza standardowy cennik fabryczny ADK Okna. Wymagana estymacja niestandardowa.",
    },
  },
  {
    id: "node-5-branch",
    type: "branch_splitter",
    position: { x: 1050, y: 150 },
    data: {
      label: "5. Rozdzielacz: Wątek Główny vs Poboczny",
      branchName: "Rozgałęzienie: Rabaty & Wytyczne Techniczne",
      branchDescription: "Wątek A przetwarza wycenę i rabaty, a Wątek Poboczny B weryfikuje montaż i obróbkę.",
      parallelMode: "parallel_all",
    },
  },
  {
    id: "node-6-cond",
    type: "condition_branch",
    position: { x: 1320, y: 50 },
    data: {
      label: "6. Wątek A: Warunek B2B vs B2C",
      conditionVariable: "clientType",
      conditionOperator: "==",
      conditionValue: "business",
      customText: "Dla klienta firmowego (B2B) zaproponuj fakturę VAT 23% i termin realizacji 14 dni.",
    },
  },
  {
    id: "node-7-discount",
    type: "discount_rule",
    position: { x: 1580, y: 50 },
    data: {
      label: "7. Wątek A: Rabat > 15 000 zł",
      discountConditionType: "net_total",
      discountThreshold: 15000,
      discountPercent: 5,
    },
  },
  {
    id: "node-8-modifier",
    type: "price_modifier",
    position: { x: 1840, y: 50 },
    data: {
      label: "8. Wątek A: Dopłata za Kolor RAL",
      modifierName: "Kolor Niestandardowy RAL",
      modifierType: "percent",
      modifierValue: 15,
      modifierCategory: "service",
    },
  },
  {
    id: "node-9-prices",
    type: "price_source",
    position: { x: 2100, y: 50 },
    data: {
      label: "9. Wątek A: Cenniki Bazy ADK Okna",
      priceTables: ["polycarbonate", "glass", "sliding_walls", "installation", "extras"],
    },
  },
  {
    id: "node-10-side-prompt",
    type: "custom_prompt",
    position: { x: 1320, y: 280 },
    data: {
      label: "10. Wątek Poboczny B: Instrukcja Montażowa",
      promptText: "Wątek Poboczny: Dla zadaszeń powyżej 400 cm długości dolicz 2 szt. słupków środkowych oraz zalecaj zestaw uszczelek przeciwpyłowych.",
    },
  },
  {
    id: "node-11-comp",
    type: "custom_prompt",
    position: { x: 1580, y: 280 },
    data: {
      label: "11. Wątek Poboczny B: Standard Jakości",
      promptText: "Wytyczne Jakości: Każda wycena zadaszenia musi uwzględniać bezpłatny pomiar u klienta w promieniu 50 km od siedziby firmy.",
    },
  },
  {
    id: "node-12-output",
    type: "output_format",
    position: { x: 2360, y: 150 },
    data: {
      label: "12. Wyjście: Podsumowanie i Karta Wyceny JSON",
      customText: "Otrzymaną wycenę przedstaw w kulturalnym, fachowym tonie i wygeneruj pełną kartę wyceny JSON (estimateCard).",
    },
  },
];

const SHOWCASE_EDGES: WorkflowEdge[] = [
  { id: "e1-2", source: "node-1-trigger", target: "node-2-input" },
  { id: "e2-3", source: "node-2-input", target: "node-3-question" },
  { id: "e3-4", source: "node-3-question", target: "node-4-validation" },
  { id: "e4-5", source: "node-4-validation", target: "node-5-branch" },
  { id: "e5-6", source: "node-5-branch", target: "node-6-cond", label: "Wątek A: Wycena i Rabaty" },
  { id: "e6-7", source: "node-6-cond", target: "node-7-discount" },
  { id: "e7-8", source: "node-7-discount", target: "node-8-modifier" },
  { id: "e8-9", source: "node-8-modifier", target: "node-9-prices" },
  { id: "e9-12", source: "node-9-prices", target: "node-12-output" },
  { id: "e5-10", source: "node-5-branch", target: "node-10-side-prompt", label: "Wątek Poboczny B: Montaż" },
  { id: "e10-11", source: "node-10-side-prompt", target: "node-11-comp" },
  { id: "e11-12", source: "node-11-comp", target: "node-12-output" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNodeMeta(type: NodeType): { color: string; icon: React.ReactNode; label: string } {
  if (type === "trigger") return { color: "#4ABBC3", icon: <Sparkles size={14} style={{ color: "#4ABBC3" }} />, label: "Wyzwolenie" };
  const p = NODE_PALETTE.find((n) => n.type === type);
  return p
    ? { color: p.color, icon: <span style={{ color: p.color }}>{p.icon}</span>, label: p.label }
    : { color: "var(--line)", icon: null, label: type };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowCanvas() {
  const rawWorkflows     = useQuery(api.aiWorkflows.listWorkflows);
  const workflows        = rawWorkflows ?? [];
  const promptComponents = useQuery(api.aiWorkflows.listPromptComponents) ?? [];
  const saveDraft       = useMutation(api.aiWorkflows.saveWorkflowDraft);
  const activateWf      = useMutation(api.aiWorkflows.activateWorkflow);
  const seedShowcase    = useMutation(api.aiWorkflows.seedShowcaseWorkflow);
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

  // ── Canvas drag & pan & zoom state ──
  const [selectedNodeId,     setSelectedNodeId]     = useState<string | null>(null);
  const [editingNodeModalId, setEditingNodeModalId] = useState<string | null>(null);
  const [draggedNodeId,      setDraggedNodeId]      = useState<string | null>(null);
  const [dragOffset,         setDragOffset]         = useState({ x: 0, y: 0 });
  const [mouseDownPos,       setMouseDownPos]       = useState<{ x: number; y: number } | null>(null);

  // Pan & Zoom state
  const [pan,       setPan]       = useState({ x: 0, y: 0 });
  const [zoom,      setZoom]      = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart,  setPanStart]  = useState({ x: 0, y: 0 });

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

  // Auto-select or auto-seed showcase workflow if empty
  useEffect(() => {
    if (rawWorkflows && rawWorkflows.length === 0 && !selectedWfId) {
      seedShowcase({ serviceType: "Zabudowa tarasu" })
        .then((id) => {
          queueMicrotask(() => setSelectedWfId(id));
        })
        .catch(() => {});
    } else if (rawWorkflows && rawWorkflows.length > 0 && !selectedWfId) {
      const activeOrFirst = rawWorkflows.find((w) => w.status === "active") ?? rawWorkflows[0];
      if (activeOrFirst) {
        queueMicrotask(() => setSelectedWfId(activeOrFirst._id));
      }
    }
  }, [rawWorkflows, selectedWfId, seedShowcase]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingNodeModalId) {
        setEditingNodeModalId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingNodeModalId]);

  // ── Canvas handlers ───────────────────────────────────────────────────────

  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (editingNodeModalId) return;
    const target = e.target as HTMLElement | SVGElement | null;
    if (target && target.closest && target.closest("[data-workflow-node='true']")) return;

    setSelectedNodeId(null);
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (editingNodeModalId) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNodeId(nodeId);
    setMouseDownPos({ x: e.clientX, y: e.clientY });

    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mouseXWorld = (e.clientX - r.left - pan.x) / zoom;
    const mouseYWorld = (e.clientY - r.top - pan.y) / zoom;

    const n = nodes.find((n) => n.id === nodeId);
    if (n) {
      setDragOffset({
        x: mouseXWorld - n.position.x,
        y: mouseYWorld - n.position.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (editingNodeModalId || !canvasRef.current) return;

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!draggedNodeId) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mouseXWorld = (e.clientX - r.left - pan.x) / zoom;
    const mouseYWorld = (e.clientY - r.top - pan.y) / zoom;

    const x = Math.round(mouseXWorld - dragOffset.x);
    const y = Math.round(mouseYWorld - dragOffset.y);

    setNodes((prev) =>
      prev.map((n) => (n.id === draggedNodeId ? { ...n, position: { x, y } } : n))
    );
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (editingNodeModalId) return;
    if (isPanning) {
      setIsPanning(false);
    }
    if (draggedNodeId && mouseDownPos) {
      const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      if (dist < 4) {
        setEditingNodeModalId(draggedNodeId);
      }
    }
    setDraggedNodeId(null);
    setMouseDownPos(null);
  };

  const handleFitView = () => {
    if (!nodes || nodes.length === 0 || !canvasRef.current) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const maxX = Math.max(...nodes.map((n) => n.position.x + 220));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(...nodes.map((n) => n.position.y + 120));

    const r = canvasRef.current.getBoundingClientRect();
    const width = maxX - minX + 140;
    const height = maxY - minY + 140;

    const zoomX = r.width / width;
    const zoomY = r.height / height;
    const fitZoom = Math.min(1.0, Math.max(0.35, Math.min(zoomX, zoomY)));

    const panX = (r.width - (maxX + minX) * fitZoom) / 2;
    const panY = (r.height - (maxY + minY) * fitZoom) / 2;

    setZoom(Number(fitZoom.toFixed(2)));
    setPan({ x: Math.round(panX), y: Math.round(panY) });
  };

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
    setEditingNodeModalId(newId);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (editingNodeModalId === nodeId) setEditingNodeModalId(null);
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

  const editingNode = nodes.find((n) => n.id === editingNodeModalId);

  const renderNodeModal = () => {
    if (!editingNode) return null;
    const meta = getNodeMeta(editingNode.type);

    return (
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            backdropMouseDownRef.current = true;
          } else {
            backdropMouseDownRef.current = false;
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && backdropMouseDownRef.current) {
            setEditingNodeModalId(null);
          }
          backdropMouseDownRef.current = false;
        }}
      >
        <div
          style={{
            backgroundColor: "var(--panel)",
            borderRadius: 12,
            border: "1px solid var(--line-2)",
            width: "100%",
            maxWidth: 560,
            maxHeight: "88vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div style={{
            padding: "12px 18px", borderBottom: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            backgroundColor: `${meta.color}12`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${meta.color}25`, border: `1px solid ${meta.color}50`, display: "flex", alignItems: "center", justifyContent: "center", color: meta.color, flexShrink: 0 }}>
                {meta.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
                  Konfiguracja Węzła: {editingNode.data.label}
                </div>
                <div style={{ fontSize: 10, color: meta.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {meta.label} ({editingNode.type})
                </div>
              </div>
            </div>
            <button
              onClick={() => setEditingNodeModalId(null)}
              style={{ border: "none", background: "transparent", color: "var(--text-mute)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: "16px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Step Label */}
            <div>
              <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Etykieta kroku w grafie</label>
              <input
                type="text" className="panel"
                style={{ width: "100%", padding: "6px 9px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", fontWeight: 600 }}
                value={editingNode.data.label}
                onChange={(e) => updateNode(editingNode.id, { label: e.target.value })}
              />
            </div>

            {/* Custom Prompt Editor */}
            {editingNode.type === "custom_prompt" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <label className="up mute" style={{ fontSize: 9, fontWeight: 700 }}>Treść swobodnego promptu dla AI</label>
                <textarea
                  className="panel" rows={7} placeholder="Wpisz bezpośrednio treść promptu/instrukcji dla modelu AI..."
                  value={editingNode.data.promptText || ""}
                  onChange={(e) => updateNode(editingNode.id, { promptText: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", resize: "vertical", fontFamily: "monospace", lineHeight: 1.5 }}
                />
              </div>
            )}

            {/* Prompt Trigger Editor */}
            {editingNode.type === "prompt_trigger" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Rola / Kontekst zapytania (Prompt Role)</label>
                  <input
                    type="text" className="panel" placeholder="np. Klient pytający o wycenę zadaszenia..."
                    value={editingNode.data.promptRole || ""}
                    onChange={(e) => updateNode(editingNode.id, { promptRole: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>

                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 5 }}>Kluczowe dane do rozpoznania i wyciągnięcia</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {STANDARD_INPUT_FIELDS.map((f) => {
                      const isChecked = (editingNode.data.extractFields || []).includes(f.id);
                      return (
                        <label key={f.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", backgroundColor: "var(--panel)", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--line)" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const curr = editingNode.data.extractFields || [];
                              updateNode(editingNode.id, {
                                extractFields: e.target.checked ? [...curr, f.id] : curr.filter((x) => x !== f.id),
                              });
                            }}
                          />
                          {f.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Przykładowy prompt klienta</label>
                  <textarea
                    className="panel" rows={2} placeholder="np. Dzień dobry, poproszę o wycenę zadaszenia 400x300 cm..."
                    value={editingNode.data.samplePrompt || ""}
                    onChange={(e) => updateNode(editingNode.id, { samplePrompt: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)", resize: "vertical" }}
                  />
                </div>
              </div>
            )}

            {/* Prompt Component Editor */}
            {editingNode.type === "prompt_component" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <label className="up mute" style={{ fontSize: 9 }}>Podpięty komponent wytycznych z bazy</label>
                <select
                  className="panel"
                  value={editingNode.data.componentId || ""}
                  onChange={(e) => {
                    const cid = e.target.value ? (e.target.value as Id<"aiPromptComponents">) : undefined;
                    const comp = (promptComponents as PromptComponentItem[]).find((c) => c._id === cid);
                    updateNode(editingNode.id, { componentId: cid, label: comp ? `Wytyczne: ${comp.title}` : editingNode.data.label });
                  }}
                  style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                >
                  <option value="">-- Wybierz komponent --</option>
                  {(promptComponents as PromptComponentItem[]).map((c) => (
                    <option key={c._id} value={c._id}>📄 {c.title}</option>
                  ))}
                </select>

                {renderAttachedComponentEditor(editingNode.data.componentId, "Wytyczne")}

                {!editingNode.data.componentId && (
                  <button
                    className="btn primary"
                    onClick={() => setShowAddComponent(true)}
                    style={{ padding: "5px 10px", fontSize: 11, gap: 4, width: "100%", marginTop: 2 }}
                  >
                    <Plus size={11} /> Stwórz i podepnij nowy komponent
                  </button>
                )}
              </div>
            )}

            {/* Input Required Editor */}
            {editingNode.type === "input_required" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <label className="up mute" style={{ fontSize: 9 }}>Wymagane pola do wyceny</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {STANDARD_INPUT_FIELDS.map((f) => {
                    const isChecked = (editingNode.data.requiredFields || []).includes(f.id);
                    return (
                      <label key={f.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", backgroundColor: "var(--panel)", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--line)" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const curr = editingNode.data.requiredFields || [];
                            updateNode(editingNode.id, {
                              requiredFields: e.target.checked ? [...curr, f.id] : curr.filter((x) => x !== f.id),
                            });
                          }}
                        />
                        {f.label}
                      </label>
                    );
                  })}
                </div>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Dedykowane pytanie/instrukcja AI</label>
                  <input
                    type="text" className="panel" placeholder="np. Podaj długość i szerokość dachu w cm..."
                    value={editingNode.data.inputPrompt || ""}
                    onChange={(e) => updateNode(editingNode.id, { inputPrompt: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
              </div>
            )}

            {/* Condition Branch Editor */}
            {editingNode.type === "condition_branch" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Zmienna warunku</label>
                  <input
                    type="text" className="panel" placeholder="np. clientType, totalAreaM2, material"
                    value={editingNode.data.conditionVariable || ""}
                    onChange={(e) => updateNode(editingNode.id, { conditionVariable: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Operator</label>
                    <select
                      className="panel"
                      value={editingNode.data.conditionOperator || "=="}
                      onChange={(e) => updateNode(editingNode.id, { conditionOperator: e.target.value })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
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
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Wartość porównania</label>
                    <input
                      type="text" className="panel" placeholder="np. business, 25"
                      value={editingNode.data.conditionValue || ""}
                      onChange={(e) => updateNode(editingNode.id, { conditionValue: e.target.value })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Wytyczne przy SPEŁNIONYM warunku (TAK)</label>
                  <select
                    className="panel"
                    value={editingNode.data.componentIdTrue || ""}
                    onChange={(e) => updateNode(editingNode.id, { componentIdTrue: e.target.value ? (e.target.value as Id<"aiPromptComponents">) : undefined })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  >
                    <option value="">-- Wybierz komponent wytycznych (Brak) --</option>
                    {(promptComponents as PromptComponentItem[]).map((c) => (
                      <option key={c._id} value={c._id}>📄 {c.title}</option>
                    ))}
                  </select>
                  {renderAttachedComponentEditor(editingNode.data.componentIdTrue, "TAK")}
                </div>

                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Wytyczne przy NIESPEŁNIONYM warunku (NIE)</label>
                  <select
                    className="panel"
                    value={editingNode.data.componentIdFalse || ""}
                    onChange={(e) => updateNode(editingNode.id, { componentIdFalse: e.target.value ? (e.target.value as Id<"aiPromptComponents">) : undefined })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  >
                    <option value="">-- Wybierz komponent wytycznych (Brak) --</option>
                    {(promptComponents as PromptComponentItem[]).map((c) => (
                      <option key={c._id} value={c._id}>📄 {c.title}</option>
                    ))}
                  </select>
                  {renderAttachedComponentEditor(editingNode.data.componentIdFalse, "NIE")}
                </div>
              </div>
            )}

            {/* Validation Gate Editor */}
            {editingNode.type === "validation_gate" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Szerokość Min (cm)</label>
                    <input
                      type="number" className="panel" placeholder="300"
                      value={editingNode.data.validationMinWidth ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { validationMinWidth: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Szerokość Max (cm)</label>
                    <input
                      type="number" className="panel" placeholder="500"
                      value={editingNode.data.validationMaxWidth ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { validationMaxWidth: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Długość Min (cm)</label>
                    <input
                      type="number" className="panel" placeholder="306"
                      value={editingNode.data.validationMinLength ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { validationMinLength: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Długość Max (cm)</label>
                    <input
                      type="number" className="panel" placeholder="1206"
                      value={editingNode.data.validationMaxLength ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { validationMaxLength: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Komunikat błędu walidacji</label>
                  <input
                    type="text" className="panel" placeholder="Wymiar niestandardowy - zalecana wycena indywidualna"
                    value={editingNode.data.validationErrorMessage || ""}
                    onChange={(e) => updateNode(editingNode.id, { validationErrorMessage: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
              </div>
            )}

            {/* Discount Rule Editor */}
            {editingNode.type === "discount_rule" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Kryterium przyznania rabatu</label>
                  <select
                    className="panel"
                    value={editingNode.data.discountConditionType || "net_total"}
                    onChange={(e) => updateNode(editingNode.id, { discountConditionType: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  >
                    <option value="net_total">Suma netto wyceny (zł)</option>
                    <option value="area_m2">Powierzchnia tarasu (m²)</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Próg aktywacji</label>
                    <input
                      type="number" className="panel" placeholder="15000"
                      value={editingNode.data.discountThreshold ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { discountThreshold: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Wysokość rabatu (%)</label>
                    <input
                      type="number" className="panel" placeholder="5"
                      value={editingNode.data.discountPercent ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { discountPercent: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Price Modifier Editor */}
            {editingNode.type === "price_modifier" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Nazwa dopłaty / modyfikatora</label>
                  <input
                    type="text" className="panel" placeholder="np. Kolor Niestandardowy RAL"
                    value={editingNode.data.modifierName || ""}
                    onChange={(e) => updateNode(editingNode.id, { modifierName: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Typ modyfikatora</label>
                    <select
                      className="panel"
                      value={editingNode.data.modifierType || "percent"}
                      onChange={(e) => updateNode(editingNode.id, { modifierType: e.target.value as "percent" | "fixed" })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    >
                      <option value="percent">% Procentowo</option>
                      <option value="fixed">zł Kwotowo</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Wartość</label>
                    <input
                      type="number" className="panel" placeholder="15"
                      value={editingNode.data.modifierValue ?? ""}
                      onChange={(e) => updateNode(editingNode.id, { modifierValue: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Kategoria w karcie wyceny</label>
                  <select
                    className="panel"
                    value={editingNode.data.modifierCategory || "extras"}
                    onChange={(e) => updateNode(editingNode.id, { modifierCategory: e.target.value as "service" | "installation" | "extras" })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  >
                    <option value="service">Usługa (service)</option>
                    <option value="installation">Montaż (installation)</option>
                    <option value="extras">Dodatki (extras)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Question Step Editor */}
            {editingNode.type === "question_step" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Treść pytania do klienta</label>
                  <input
                    type="text" className="panel" placeholder="np. Czy taras posiada wylewkę betonową?"
                    value={editingNode.data.questionText || ""}
                    onChange={(e) => updateNode(editingNode.id, { questionText: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Sugerowane opcje (oddzielone przecinkami)</label>
                  <input
                    type="text" className="panel" placeholder="Tak, Nie, W trakcie budowy"
                    value={(editingNode.data.questionOptions || []).join(", ")}
                    onChange={(e) => updateNode(editingNode.id, { questionOptions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
              </div>
            )}

            {/* Price Sources */}
            {editingNode.type === "price_source" && (
              <div style={{ backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 4 }}>Wybierz cenniki do załadowania dla AI</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {PRICE_TABLE_OPTIONS.map((pt) => (
                    <label key={pt.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", backgroundColor: "var(--panel)", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--line)" }}>
                      <input type="checkbox"
                        checked={!!editingNode.data.priceTables?.includes(pt.id)}
                        onChange={(e) => {
                          const curr = editingNode.data.priceTables ?? [];
                          updateNode(editingNode.id, { priceTables: e.target.checked ? [...curr, pt.id] : curr.filter((t) => t !== pt.id) });
                        }} />
                      {pt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Branch Splitter Editor */}
            {editingNode.type === "branch_splitter" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Nazwa wątku / gałęzi</label>
                  <input
                    type="text" className="panel" placeholder="np. Wątek B: Wymogi Techniczne i Montaż"
                    value={editingNode.data.branchName || ""}
                    onChange={(e) => updateNode(editingNode.id, { branchName: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  />
                </div>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Cel / Opis działania tego wątku</label>
                  <textarea
                    className="panel" rows={2} placeholder="np. Wykonaj równolegle analizę wymogów montażowych oraz stóp fundamentowych..."
                    value={editingNode.data.branchDescription || ""}
                    onChange={(e) => updateNode(editingNode.id, { branchDescription: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)", resize: "vertical" }}
                  />
                </div>
                <div>
                  <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3 }}>Tryb wykonywania wątku przez AI</label>
                  <select
                    className="panel"
                    value={editingNode.data.parallelMode || "parallel_all"}
                    onChange={(e) => updateNode(editingNode.id, { parallelMode: e.target.value })}
                    style={{ width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  >
                    <option value="parallel_all">Równoległe (Wszystkie gałęzie wykonuj współbieżnie)</option>
                    <option value="first_matching">Wątek warunkowy (Pierwsza pasująca gałąź)</option>
                    <option value="background_context">Wątek poboczny w tle (Kontekst dodatkowy)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Connection / Edge & Side Thread Management */}
            <div style={{ backgroundColor: "var(--panel-2)", padding: 12, borderRadius: 8, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>🔗 Połączenia wychodzące i Wątki Poboczne ({edges.filter((e) => e.source === editingNode.id).length})</span>
              </div>
              
              {/* Outgoing edges list */}
              {edges.filter((e) => e.source === editingNode.id).length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
                  Brak wychodzących połączeń z tego węzła. Węzeł nie przekazuje sygnału dalej.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {edges.filter((e) => e.source === editingNode.id).map((edge) => {
                    const targetNode = nodes.find((n) => n.id === edge.target);
                    return (
                      <div key={edge.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--panel)", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--line)", fontSize: 11 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, color: "var(--accent)" }}>➜</span>
                          <span style={{ fontWeight: 600 }}>{targetNode?.data.label || edge.target}</span>
                          <input
                            type="text"
                            placeholder="Etykieta wątku (np. Wątek A)"
                            value={edge.label || ""}
                            onChange={(ev) => {
                              const val = ev.target.value;
                              setEdges((prev) => prev.map((eg) => eg.id === edge.id ? { ...eg, label: val } : eg));
                            }}
                            style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)", width: 140 }}
                          />
                        </div>
                        <button
                          onClick={() => setEdges((prev) => prev.filter((eg) => eg.id !== edge.id))}
                          style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer", padding: 2 }}
                          title="Usuń połączenie"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Add Connection */}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <select
                  id={`add-conn-${editingNode.id}`}
                  className="panel"
                  style={{ flex: 1, padding: "5px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--line)" }}
                  defaultValue=""
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (!targetId) return;
                    if (edges.some((eg) => eg.source === editingNode.id && eg.target === targetId)) {
                      alert("Połączenie do tego węzła już istnieje.");
                      e.target.value = "";
                      return;
                    }
                    const count = edges.filter((eg) => eg.source === editingNode.id).length;
                    const defaultBranchLabel = editingNode.type === "branch_splitter" ? `Wątek ${count + 1}` : undefined;
                    setEdges((prev) => [...prev, { id: `e-${editingNode.id}-${targetId}-${Date.now()}`, source: editingNode.id, target: targetId, label: defaultBranchLabel }]);
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Dodaj połączenie / wątek poboczny do węzła...</option>
                  {nodes
                    .filter((n) => n.id !== editingNode.id && !edges.some((eg) => eg.source === editingNode.id && eg.target === n.id))
                    .map((n) => (
                      <option key={n.id} value={n.id}>➜ {n.data.label} ({n.type})</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Custom Text / Instructions */}
            <div>
              <label className="up mute" style={{ fontSize: 9, display: "block", marginBottom: 3, fontWeight: 700 }}>
                Dodatkowe wytyczne dla kroku (Meta-prompt dla AI)
              </label>
              <textarea className="panel" rows={3} style={{
                width: "100%", padding: "6px 9px", fontSize: 11, borderRadius: 6,
                border: "1px solid var(--line)", resize: "vertical", fontFamily: "monospace"
              }}
                value={editingNode.data.customText ?? ""}
                onChange={(e) => updateNode(editingNode.id, { customText: e.target.value })}
                placeholder="Wpisz specyficzne instrukcje..." />
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: "10px 16px", borderTop: "1px solid var(--line)",
            backgroundColor: "var(--panel-2)", display: "flex", alignItems: "center",
            justifyContent: "space-between",
          }}>
            <button
              onClick={() => handleDeleteNode(editingNode.id)}
              style={{
                border: "none", backgroundColor: "#ef444415", color: "var(--bad)",
                fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "5px 10px",
                borderRadius: 5, display: "flex", alignItems: "center", gap: 4
              }}
            >
              <Trash2 size={12} /> Usuń ten węzeł
            </button>
            <button
              className="btn primary"
              onClick={() => setEditingNodeModalId(null)}
              style={{ padding: "5px 14px", fontSize: 11, gap: 4, fontWeight: 600 }}
            >
              <CheckCircle size={13} /> Gotowe / Zapisz
            </button>
          </div>
        </div>
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
          <button
            className="btn"
            onClick={() => {
              setTitle("🔥 Kompleksowy Workflow Testowy ADK Okna");
              setServiceType("Zabudowa tarasu");
              setNodes(SHOWCASE_NODES);
              setEdges(SHOWCASE_EDGES);
              showStatus("success", "Wczytano 12 węzłów szablonu testowego na płótno. Kliknij 'Zapisz Draft' lub 'Aktywuj'!");
            }}
            style={{ gap: 5, padding: "5px 11px", fontSize: 11, backgroundColor: "#6366f115", color: "#6366f1", border: "1px solid #6366f140", fontWeight: 600 }}
            title="Wczytaj bezpośrednio na płótno szablon testowy z wszystkimi 12 węzłami i rozgałęzieniami"
          >
            <Sparkles size={13} /> ⚡ Wczytaj Szablon Testowy
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                setTitle("🔥 Kompleksowy Workflow Testowy ADK Okna");
                setServiceType("Zabudowa tarasu");
                setNodes(SHOWCASE_NODES);
                setEdges(SHOWCASE_EDGES);
                const id = await saveDraft({
                  id: selectedWfId ?? undefined,
                  serviceType: "Zabudowa tarasu",
                  title: "🔥 Kompleksowy Workflow Testowy ADK Okna",
                  description: "Workflow testowy demonstrujący wszystkie 12 typów węzłów oraz równoległe wątki poboczne.",
                  nodes: SHOWCASE_NODES,
                  edges: SHOWCASE_EDGES,
                });
                setSelectedWfId(id);
                await activateWf({ id });
                showStatus("success", "Zapisano i aktywowano workflow testowy w bazie danych!");
              } catch (err) {
                showStatus("error", `Błąd zapisu: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
              }
            }}
            style={{ gap: 5, padding: "5px 11px", fontSize: 11, backgroundColor: "#ec489915", color: "#ec4899", border: "1px solid #ec489940", fontWeight: 600 }}
            title="Zapisz i aktywuj kompleksowy workflow testowy w bazie danych Convex"
          >
            <Play size={13} /> 🔥 Zapisz Szablon w Baza Dev
          </button>
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
          onMouseDown={handleBgMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          style={{
            flex: 1, height: "100%", position: "relative", overflow: "hidden",
            backgroundImage: "radial-gradient(circle, var(--line) 1px, transparent 1px)",
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            cursor: isPanning ? "grabbing" : draggedNodeId ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {/* Floating Pan & Zoom Toolbar */}
          <div style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 50,
            display: "flex", alignItems: "center", gap: 4,
            backgroundColor: "var(--panel)", padding: "4px 8px", borderRadius: 8,
            border: "1px solid var(--line-2)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            backdropFilter: "blur(4px)",
          }}>
            <button
              onClick={() => setZoom((z) => Number(Math.max(0.35, z - 0.1).toFixed(2)))}
              style={{ border: "none", background: "transparent", color: "var(--text)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
              title="Oddal (Zoom Out)"
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 36, textAlign: "center", color: "var(--text-strong)", fontFamily: "monospace" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Number(Math.min(2.0, z + 0.1).toFixed(2)))}
              style={{ border: "none", background: "transparent", color: "var(--text)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
              title="Przybliż (Zoom In)"
            >
              <ZoomIn size={14} />
            </button>
            <div style={{ width: 1, height: 16, backgroundColor: "var(--line)", margin: "0 2px" }} />
            <button
              onClick={handleFitView}
              style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", padding: "3px 7px", fontSize: 10, fontWeight: 700, borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}
              title="Dopasuj widok do wszystkich węzłów"
            >
              <Maximize2 size={12} /> Dopasuj
            </button>
            <button
              onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
              style={{ border: "none", background: "transparent", color: "var(--text-dim)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
              title="Resetuj widok (100% i środek)"
            >
              <RotateCcw size={12} />
            </button>
            <div style={{ width: 1, height: 16, backgroundColor: "var(--line)", margin: "0 2px" }} />
            <span style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3, paddingLeft: 2 }}>
              <Hand size={12} style={{ color: "var(--accent)" }} /> Przesuwaj planszę chwytając tło
            </span>
          </div>

          {/* Transformed Viewport Container */}
          <div
            style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          >
            {/* SVG Edges */}
            <svg style={{ width: 5000, height: 5000, position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
              {edges.map((e) => {
                const src = nodes.find((n) => n.id === e.source);
                const tgt = nodes.find((n) => n.id === e.target);
                if (!src || !tgt) return null;
                const x1 = src.position.x + 210;
                const y1 = src.position.y + 17;
                const x2 = tgt.position.x;
                const y2 = tgt.position.y + 17;
                const dx = Math.abs(x2 - x1) * 0.5;
                const pathStr = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                const isBranchEdge = src.type === "branch_splitter" || !!e.label;
                const strokeColor = isBranchEdge ? "#ec4899" : "var(--accent)";

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={e.id}>
                    <path d={pathStr} fill="none" stroke="var(--line-2)" strokeWidth="3" />
                    <path d={pathStr} fill="none" stroke={strokeColor} strokeWidth={isBranchEdge ? "2" : "1.5"} strokeDasharray={isBranchEdge ? "6,3" : "5,5"} />
                    <circle cx={x1} cy={y1} r="3" fill={strokeColor} />
                    <circle cx={x2} cy={y2} r="3" fill={strokeColor} />
                    {e.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect x="-42" y="-9" width="84" height="17" rx="8" fill="var(--panel)" stroke={strokeColor} strokeWidth="1" />
                        <text x="0" y="3" textAnchor="middle" fill="var(--text-strong)" fontSize="9" fontWeight="700">
                          {e.label}
                        </text>
                      </g>
                    )}
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
                  data-workflow-node="true"
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
                    pointerEvents: "auto",
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
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingNodeModalId(node.id); }}
                        style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", padding: 2, lineHeight: 1 }}
                        title="Konfiguruj węzeł w modalu"
                      >
                        <Sliders size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                        style={{ border: "none", background: "transparent", color: "var(--bad)", cursor: "pointer", padding: 2, opacity: 0.6, lineHeight: 1 }}
                        title="Usuń krok z workflowu"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Node Body */}
                  <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                      {node.data.label}
                    </div>

                    {/* Rich Node Details */}
                    {node.type === "branch_splitter" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, backgroundColor: "#ec489910", padding: "4px 6px", borderRadius: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#ec4899" }}>
                          🔀 {node.data.branchName || "Wątek Poboczny"}
                        </div>
                        {node.data.branchDescription && (
                          <div style={{ fontSize: 10, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {node.data.branchDescription}
                          </div>
                        )}
                      </div>
                    )}

                    {node.type === "custom_prompt" && (
                      <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace", backgroundColor: "#6366f112", padding: "4px 6px", borderRadius: 4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        💬 {node.data.promptText || "Brak treści promptu..."}
                      </div>
                    )}

                    {node.type === "prompt_trigger" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {node.data.promptRole && (
                          <div style={{ fontSize: 10, color: "#4abbc3", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            🎭 Rola: {node.data.promptRole}
                          </div>
                        )}
                        {node.data.extractFields && node.data.extractFields.length > 0 && (
                          <div style={{ fontSize: 10, color: "var(--text-mute)", display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {node.data.extractFields.map((f) => (
                              <span key={f} style={{ backgroundColor: "#4abbc318", color: "#4abbc3", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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

                  {/* Ports aligned to header bar center (17px) */}
                  <div
                    style={{
                      position: "absolute",
                      left: -6,
                      top: 17,
                      transform: "translateY(-50%)",
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: meta.color,
                      border: "2px solid var(--panel)",
                      boxShadow: `0 0 0 2px ${meta.color}40`,
                      zIndex: 4,
                    }}
                    title="Port wejściowy"
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: -6,
                      top: 17,
                      transform: "translateY(-50%)",
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: meta.color,
                      border: "2px solid var(--panel)",
                      boxShadow: `0 0 0 2px ${meta.color}40`,
                      zIndex: 4,
                    }}
                    title="Port wyjściowy"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Panel (Combined Node Inspector + Component Library) ───────── */}
        <div style={{
          width: 360, height: "100%", borderLeft: "1px solid var(--line)",
          backgroundColor: "var(--panel)", display: "flex", flexDirection: "column",
          flexShrink: 0, overflow: "hidden",
        }}>

          {/* ── Node Inspector Summary ── */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0, backgroundColor: "var(--panel-2)" }}>
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
                <div style={{ backgroundColor: "var(--panel)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-strong)" }}>
                    {selectedNode.data.label}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>
                    Typ węzła: {selectedNode.type}
                  </div>
                </div>
                <button
                  className="btn primary"
                  onClick={() => setEditingNodeModalId(selectedNode.id)}
                  style={{ width: "100%", padding: "6px 10px", fontSize: 11, gap: 5, justifyContent: "center" }}
                >
                  <Sliders size={12} /> Otwórz konfigurację w modalu
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "var(--text-mute)", margin: 0, lineHeight: 1.5 }}>
                Kliknij dowolny węzeł na płótnie, aby otworzyć jego konfigurację w oknie modalnym.
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
      {renderNodeModal()}
    </div>
  );
}
