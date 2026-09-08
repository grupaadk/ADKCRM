"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import imageCompression from "browser-image-compression";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Home,
  Search,
  Bell,
  User,
  Plus,
  Camera,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowLeft,
  RefreshCw,
  Video,
  MapPin,
  Clock,
  Wrench,
  Calendar,
  List,
  LayoutGrid,
  Smartphone,
  RotateCw,
  Folder,
} from "lucide-react";
import OrderDriveBrowser from "@/app/admin/klient/[id]/zlecenie/[orderId]/OrderDriveBrowser";


import { DateStrip } from "@/components/ekipa/DateStrip";
import dynamic from "next/dynamic";

const MobileWeekCalendar = dynamic(() => import("@/components/ekipa/MobileWeekCalendar"), { ssr: false });
type Tab = "home" | "search" | "notifications" | "profile" | "add-document";

const DOCUMENT_LABELS: Record<string, string> = {
  pomiar: "Pomiar",
  umowa: "Umowa",
  gwarancja_alco: "Gwarancja ALCO",
  odbior_inwestor: "Odbiór inwestorski",
  protokol_montaz: "Protokół montażu",
  reklamacja: "Reklamacja",
};

const DOCUMENT_GROUPS = [
  { title: "Pomiary", keys: ["pomiar"] },
  { title: "Umowy", keys: ["umowa"] },
  { title: "Protokoły odbioru", keys: ["odbior_inwestor", "protokol_montaz"] },
  { title: "Gwarancje", keys: ["gwarancja_alco"] },
  { title: "Inne", keys: ["reklamacja"] },
];

const LEGACY_DOCUMENT_KEYS = new Set([
  "pomiar", "umowa", "gwarancja_alco",
  "rekojmia_adk", "odbior_inwestor", "protokol_montaz",
  "faktura", "reklamacja"
]);

import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, LogIn, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

function SortablePhotoItem({ id, src, index, rotation, onRemove, onRotate }: { id: string; src: string; index: number; rotation: number; onRemove: (index: number) => void; onRotate: (index: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[3/4] bg-slate-100 touch-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Strona ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
      <div className="absolute top-0 left-0 bg-black/40 text-white text-[9px] font-bold px-1 py-0.5 rounded-br-md">
        {index + 1}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking remove
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition z-10 shadow"
      >
        <X className="size-3" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking rotate
        onClick={(e) => {
          e.stopPropagation();
          onRotate(index);
        }}
        className="absolute bottom-0.5 right-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1.5 transition z-10 shadow"
      >
        <RotateCw className="size-3" />
      </button>
    </div>
  );
}

import { useStatuses } from "@/components/StatusLabelsContext";

export default function AppPwaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { signIn, signOut } = useAuthActions();

  // Auth User Query
  const me = useQuery(api.users.me);

  // Login Form state for PWA
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [scheduleView, setScheduleView] = useState<"list" | "calendar">("list");
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(orientation: landscape)");
    setIsLandscape(mql.matches);
    
    const onChange = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
      if (activeTab === "home") {
        setScheduleView(e.matches ? "calendar" : "list");
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [activeTab]);

  const statuses = useStatuses();
  const statusMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.key, s.label])),
    [statuses]
  );

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      await signIn("password", {
        flow: "signIn",
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      setLoginEmail("");
      setLoginPassword("");
      setActiveTab("home");
    } catch {
      setLoginError("Nieprawidłowy login lub hasło.");
    } finally {
      setLoginSubmitting(false);
    }
  }

  // Get user's first name for greeting
  const userFirstName = me?.displayName
    ? me.displayName.split(" ")[0]
    : me?.login
    ? me.login.split("@")[0]
    : null;


  // Schedule / Calendar State
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(new Date());
  const [selectedScheduleUserId, setSelectedScheduleUserId] = useState<Id<"users"> | "all" | null>(null);
  const allUsersForFilter = useQuery(api.users.listAllActive);

  const userSchedule = useQuery(
    api.installationTeams.getScheduleForUser,
    selectedScheduleUserId === "all" 
      ? { allUsers: true, userId: "all" } 
      : selectedScheduleUserId 
      ? { userId: selectedScheduleUserId } 
      : {}
  );


  // Form State

  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [, setSelectedClientName] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [documentType, setDocumentType] = useState<string>("pomiar");
  const [file, setFile] = useState<File | null>(null);
  const [signatureStatus] = useState<"signed" | "not_applicable" | null>("signed");
  const [scanPages, setScanPages] = useState<File[]>([]);
  const [scanPreviews, setScanPreviews] = useState<string[]>([]);
  const [scanRotations, setScanRotations] = useState<number[]>([]);
  const [uploadTargetMode, setUploadTargetMode] = useState<"replace_doc" | "drive_browser">("replace_doc");
  const [activeDriveFolder, setActiveDriveFolder] = useState<{ id: string; name: string } | null>(null);
  const [driveCustomFileName, setDriveCustomFileName] = useState("");
  const [driveRefreshKey, setDriveRefreshKey] = useState(0);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: true; url: string } | { ok: false; error: string } | null>(null);

  const templates = useQuery(api.documentTemplates.list);
  const dynamicDocumentTypes = useMemo(() => {
    const list: Array<{ id: string, label: string, group: string }> = [];
    
    if (!templates) {
      for (const group of DOCUMENT_GROUPS) {
        group.keys.forEach(k => list.push({ id: k, label: DOCUMENT_LABELS[k] ?? k, group: group.title }));
      }
      return list;
    }
    
    const templatesByKey: Record<string, typeof templates> = {};
    for (const t of templates) {
      if (!templatesByKey[t.key]) templatesByKey[t.key] = [];
      templatesByKey[t.key].push(t);
    }
    
    for (const group of DOCUMENT_GROUPS) {
      if (group.title === "Gwarancje") {
        const legacyTpls = group.keys.flatMap((k) =>
          (templatesByKey[k] ?? []).filter((t) => t.isActive && !!t.googleDriveFileId)
        );
        const extraTpls = Object.entries(templatesByKey)
          .filter(([k]) => k.startsWith("gwarancja_") && !LEGACY_DOCUMENT_KEYS.has(k))
          .flatMap(([, tpls]) => (tpls ?? []).filter((t) => t.isActive && !!t.googleDriveFileId));
        
        const allTpls = [...legacyTpls, ...extraTpls];
        if (allTpls.length > 0) {
          allTpls.forEach(t => list.push({ id: t.key, label: t.name, group: group.title }));
        } else {
          group.keys.forEach(k => list.push({ id: k, label: DOCUMENT_LABELS[k] ?? k, group: group.title }));
        }
      } else {
        group.keys.forEach(k => list.push({ id: k, label: DOCUMENT_LABELS[k] ?? k, group: group.title }));
      }
    }
    return list;
  }, [templates]);

  // Find selected order to filter document types
  const orders = useQuery(
    api.orders.listByClient,
    selectedClientId ? { clientId: selectedClientId } : "skip"
  );

  const selectedOrder = useMemo(() => {
    return orders?.find(o => o._id === selectedOrderId);
  }, [orders, selectedOrderId]);

  const availableDocumentTypes = useMemo(() => {
    if (!selectedOrder) return [];
    
    return dynamicDocumentTypes.filter(t => {
      if (LEGACY_DOCUMENT_KEYS.has(t.id)) {
        return !!selectedOrder.documents?.[t.id]?.url;
      } else {
        return !!selectedOrder.warrantyDocs?.[t.id]?.url;
      }
    });
  }, [dynamicDocumentTypes, selectedOrder]);

  // Auto-select first available document type if current is invalid
  useEffect(() => {
    if (availableDocumentTypes.length > 0) {
      const isValid = availableDocumentTypes.some(t => t.id === documentType);
      if (!isValid) {
        setDocumentType(availableDocumentTypes[0].id);
      }
    } else {
      setDocumentType("");
    }
  }, [availableDocumentTypes, documentType]);

  // Long Press State for Signet Bubble Menu
  const [showBubbleMenu, setShowBubbleMenu] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom Event Form State
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("10:00");
  const [eventIsAllDay, setEventIsAllDay] = useState(false);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventSuccess, setEventSuccess] = useState<string | null>(null);

  // Complaint form state
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false);
  const [complaintClientSearch, setComplaintClientSearch] = useState("");
  const [complaintSelectedClientId, setComplaintSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [showComplaintClientDropdown, setShowComplaintClientDropdown] = useState(false);
  const [complaintSelectedOrderId, setComplaintSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintError, setComplaintError] = useState<string | null>(null);
  const [complaintSuccess, setComplaintSuccess] = useState<string | null>(null);
  const [complaintMediaFiles, setComplaintMediaFiles] = useState<File[]>([]);
  
  const complaintCameraRef = useRef<HTMLInputElement>(null);
  const complaintVideoRef = useRef<HTMLInputElement>(null);
  const complaintFileRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scanCameraAddRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createCalendarEvent = useMutation(api.calendarEvents.createEvent);
  const uploadUserDocument = useAction(api.googleDrive.uploadUserDocumentPublic);
  const createComplaint = useMutation(api.complaints.create);
  const uploadManualOrderFile = useAction(api.googleDrive.uploadManualOrderFile);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setScanPreviews((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        
        // Zaktualizuj pliki w tle zachowując nową kolejność
        setScanPages((pages) => arrayMove(pages, oldIndex, newIndex));
        setScanRotations((rotations) => arrayMove(rotations, oldIndex, newIndex));
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const searchResults = useQuery(
    api.clients.search,
    clientSearch.trim().length >= 1 ? { searchTerm: clientSearch.trim() } : "skip"
  );

  const complaintSearchResults = useQuery(
    api.clients.search,
    complaintClientSearch.trim().length >= 1 ? { searchTerm: complaintClientSearch.trim() } : "skip"
  );

  const complaintOrders = useQuery(
    api.orders.listByClient,
    complaintSelectedClientId ? { clientId: complaintSelectedClientId } : "skip"
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed silently
      });
    }
  }, []);

  function resetForm() {
    setSelectedClientId(null);
    setSelectedClientName("");
    setClientSearch("");
    setShowClientDropdown(false);
    setSelectedOrderId(null);
    setDocumentType("pomiar");
    setFile(null);
    setScanPages([]);
    setScanPreviews([]);
    setScanRotations([]);
    setUploadTargetMode("replace_doc");
    setActiveDriveFolder(null);
    setDriveCustomFileName("");
    setDriveSuccessMsg(null);
    setDriveErrorMsg(null);
    setResult(null);
  }

  function selectClient(id: Id<"clients">, name: string) {
    setSelectedClientId(id);
    setSelectedClientName(name);
    setClientSearch(name);
    setShowClientDropdown(false);
    setSelectedOrderId(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      // Selecting a file clears any scan pages
      setScanPages([]);
      setScanPreviews([]);
      setScanRotations([]);
      setFile(e.target.files[0]);
    }
  }

  function handleScanPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    // Reset the input so the same photo can be re-added if needed
    e.target.value = "";
    // Clear single-file mode
    setFile(null);
    const preview = URL.createObjectURL(selected);
    setScanPages((prev) => [...prev, selected]);
    setScanPreviews((prev) => [...prev, preview]);
    setScanRotations((prev) => [...prev, 0]);
  }

  function handleRemoveScanPage(index: number) {
    setScanPages((prev) => prev.filter((_, i) => i !== index));
    setScanPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setScanRotations((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRotateScanPage(index: number) {
    setScanRotations((prev) => {
      const next = [...prev];
      next[index] = (next[index] + 90) % 360;
      return next;
    });
  }

  async function fileToCompressedImage(file: File, additionalRotation: number): Promise<{ dataUrl: string; width: number; height: number }> {
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      exifOrientation: true // Wymusza odczytanie EXIF
    };
    
    const compressedFile = await imageCompression(file, options);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Ręczny obrót jeśli użytkownik tak zażądał, ALBO
          // automatyczny obrót poziomego obrazu (jeśli np. naturalnie jest landscape, ale chcemy portrait).
          const needsAutoPortrait = (width > height);
          
          if (additionalRotation > 0 || needsAutoPortrait) {
            const canvas = document.createElement("canvas");
            
            // Obliczamy ostateczne wymiary płótna (jeśli kąt 90 lub 270, zamieniamy width z height)
            let finalCanvasWidth = width;
            let finalCanvasHeight = height;
            
            // Dodajemy 90 stopni z automatu jeśli obraz był landscape
            let totalRotation = additionalRotation;
            if (needsAutoPortrait) {
              totalRotation += 90;
            }
            
            // Normalizujemy obrót do 0, 90, 180, 270
            totalRotation = totalRotation % 360;
            
            if (totalRotation === 90 || totalRotation === 270) {
              finalCanvasWidth = height;
              finalCanvasHeight = width;
            }
            
            canvas.width = finalCanvasWidth;
            canvas.height = finalCanvasHeight;
            const ctx = canvas.getContext("2d");
            
            if (ctx) {
              ctx.translate(finalCanvasWidth / 2, finalCanvasHeight / 2);
              ctx.rotate((totalRotation * Math.PI) / 180);
              ctx.drawImage(img, -width / 2, -height / 2, width, height);
              
              const rotatedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
              return resolve({ dataUrl: rotatedDataUrl, width: finalCanvasWidth, height: finalCanvasHeight });
            }
          }

          // Jeśli obraz jest już pionowy i nie ma dodatkowego obrotu, używamy go bez zmian
          resolve({ dataUrl: img.src, width, height });
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  }

  async function buildPdfFromPages(pages: File[], rotations: number[]): Promise<File> {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PAGE_WIDTH = 210;
    const PAGE_HEIGHT = 297;

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage();
      const userRotation = rotations[i] || 0;
      const { dataUrl, width, height } = await fileToCompressedImage(pages[i], userRotation);
      
      const imgRatio = width / height;
      const pageRatio = PAGE_WIDTH / PAGE_HEIGHT;
      
      let finalWidth = PAGE_WIDTH;
      let finalHeight = PAGE_HEIGHT;
      
      // Dopasowanie zdjęcia zachowując oryginalne proporcje
      if (imgRatio > pageRatio) {
        finalWidth = PAGE_WIDTH;
        finalHeight = PAGE_WIDTH / imgRatio;
      } else {
        finalHeight = PAGE_HEIGHT;
        finalWidth = PAGE_HEIGHT * imgRatio;
      }
      
      // Wyśrodkowanie na stronie A4
      const x = (PAGE_WIDTH - finalWidth) / 2;
      const y = (PAGE_HEIGHT - finalHeight) / 2;
      
      doc.addImage(dataUrl, "JPEG", x, y, finalWidth, finalHeight, undefined, "MEDIUM");
    }
    const pdfBlob = doc.output("blob");
    return new File([pdfBlob], "skan.pdf", { type: "application/pdf" });
  }

  async function handleDriveFileUpload(e: React.FormEvent) {
    e.preventDefault();
    const targetFolderId = activeDriveFolder?.id || selectedOrder?.folderId;
    if (!selectedOrderId || !targetFolderId) {
      setDriveErrorMsg("Folder zlecenia w Google Drive jest niedostępny.");
      return;
    }
    if (!file && scanPages.length === 0) {
      setDriveErrorMsg("Wybierz plik lub zrób zdjęcie przed wysłaniem.");
      return;
    }

    setDriveUploading(true);
    setDriveSuccessMsg(null);
    setDriveErrorMsg(null);

    try {
      let fileToUpload: File;
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;

      if (scanPages.length > 0) {
        fileToUpload = await buildPdfFromPages(scanPages, scanRotations);
      } else if (file) {
        fileToUpload = file;
      } else {
        throw new Error("Brak wybranego pliku.");
      }

      let finalName = driveCustomFileName.trim();
      if (!finalName) {
        if (scanPages.length > 0) {
          finalName = `Zdjecie_${timestamp}.pdf`;
        } else {
          finalName = fileToUpload.name || `Plik_${timestamp}`;
        }
      } else {
        const hasExt = /\.[a-zA-Z0-9]+$/.test(finalName);
        if (!hasExt) {
          const ext = scanPages.length > 0 ? "pdf" : (fileToUpload.name.split(".").pop() || "pdf");
          finalName = `${finalName}.${ext}`;
        }
      }

      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileToUpload.type || "application/octet-stream" },
        body: fileToUpload,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };

      await uploadManualOrderFile({
        orderId: selectedOrderId,
        storageId: storageId as Id<"_storage">,
        fileName: finalName,
        mimeType: fileToUpload.type || undefined,
        targetFolderId: targetFolderId,
      });

      setFile(null);
      setScanPages([]);
      setScanPreviews([]);
      setScanRotations([]);
      setDriveCustomFileName("");
      setDriveSuccessMsg(`Pomyślnie zapisano plik "${finalName}" w folderze "${activeDriveFolder?.name ?? "Folder zlecenia"}"`);
      setDriveRefreshKey((k) => k + 1);
    } catch (err) {
      setDriveErrorMsg(err instanceof Error ? err.message : "Błąd podczas wgrywania pliku.");
    } finally {
      setDriveUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasScanPages = scanPages.length > 0;
    if (!selectedClientId || !selectedOrderId || (!file && !hasScanPages) || !signatureStatus) return;

    setUploading(true);
    setResult(null);

    try {
      // Determine file to upload: merge scan pages into PDF or use single file
      const fileToUpload = hasScanPages ? await buildPdfFromPages(scanPages, scanRotations) : file!;

      const uploadUrl = await generateUploadUrl();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileToUpload.type || "application/octet-stream" },
        body: fileToUpload,
      });

      if (!uploadResponse.ok) {
        throw new Error("Błąd podczas przesyłania pliku do pamięci tymczasowej.");
      }

      const { storageId } = await uploadResponse.json();

      const driveUrl = await uploadUserDocument({
        storageId,
        fileName: fileToUpload.name,
        orderId: selectedOrderId,
        documentType,
        signatureStatus,
      });

      setResult({ ok: true, url: driveUrl });
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd.",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleAddMediaFiles(files: FileList | null) {
    if (!files) return;
    const newArr = Array.from(files);
    setComplaintMediaFiles((prev) => [...prev, ...newArr]);
  }

  function handleRemoveMediaFile(index: number) {
    setComplaintMediaFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function startLongPress() {
    longPressTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(50);
      }
      setShowBubbleMenu(true);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function handleCreateComplaintSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complaintSelectedClientId) return;
    const targetOrderId = complaintSelectedOrderId ?? (complaintOrders && complaintOrders[0] ? complaintOrders[0]._id : null);
    if (!targetOrderId) {
      setComplaintError("Wybierz zlecenie klienta lub upewnij się, że klient posiada zlecenia.");
      return;
    }

    setComplaintSubmitting(true);
    setComplaintError(null);
    try {
      const newComplaintId = await createComplaint({
        clientId: complaintSelectedClientId,
        orderId: targetOrderId,
        startDate: Date.now(),
        description: complaintDescription.trim() || (complaintMediaFiles.length > 0 ? "Załączono pliki zdjęć/wideo" : "Zgłoszenie reklamacyjne"),
        createdBy: userFirstName ?? me?.login ?? "Pracownik ekipy PWA",
      });

      // Upload any attached photos/videos directly to the new complaint's folder
      if (complaintMediaFiles.length > 0) {
        for (let i = 0; i < complaintMediaFiles.length; i++) {
          const fileToUpload = complaintMediaFiles[i];
          const uploadUrl = await generateUploadUrl();
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": fileToUpload.type || "application/octet-stream" },
            body: fileToUpload,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Błąd przesyłania pliku ${fileToUpload.name} do pamięci tymczasowej.`);
          }

          const { storageId } = await uploadResponse.json();
          const isVideo = fileToUpload.type.startsWith("video/");
          const prefix = isVideo ? "VIDEO_REKLAMACJA" : "REKLAMACJA";

          await uploadManualOrderFile({
            orderId: targetOrderId,
            clientId: complaintSelectedClientId,
            complaintId: newComplaintId,
            storageId,
            fileName: `${prefix}_${Date.now()}_${fileToUpload.name}`,
            mimeType: fileToUpload.type || undefined,
          });

        }
      }


      setComplaintSuccess("Reklamacja została zarejestrowana" + (complaintMediaFiles.length > 0 ? ` wraz z ${complaintMediaFiles.length} plikiem/plikami!` : "!"));
      setComplaintDescription("");
      setComplaintMediaFiles([]);
      setTimeout(() => {
        setShowNewComplaintModal(false);
        setComplaintSuccess(null);
      }, 2500);
    } catch (err) {
      setComplaintError(err instanceof Error ? err.message : "Wystąpił błąd przy tworzeniu reklamacji.");
    } finally {
      setComplaintSubmitting(false);
    }
  }

  const eventTypes = useQuery(api.calendarEvents.getEventTypes);

  async function handleCreateEventSubmit(e: React.FormEvent) {

    e.preventDefault();
    if (!eventTitle.trim()) {
      setEventError("Podaj tytuł wydarzenia.");
      return;
    }

    const wlasneType = eventTypes?.find(
      (t) => t.name.toLowerCase() === "własne" || t.name.toLowerCase() === "wlasne"
    );
    const targetEventTypeId = wlasneType?._id ?? eventTypes?.[0]?._id;

    if (!targetEventTypeId) {
      setEventError("Brak dostępnego typu wydarzenia.");
      return;
    }

    setEventSubmitting(true);
    setEventError(null);
    try {
      const [year, month, day] = eventDate.split("-").map(Number);
      const startD = new Date(year, month - 1, day);

      if (!eventIsAllDay && eventStartTime) {
        const [h, m] = eventStartTime.split(":").map(Number);
        startD.setHours(h, m, 0, 0);
      } else {
        startD.setHours(0, 0, 0, 0);
      }

      const endD = new Date(year, month - 1, day);
      if (!eventIsAllDay && eventEndTime) {
        const [h, m] = eventEndTime.split(":").map(Number);
        endD.setHours(h, m, 0, 0);
      } else {
        endD.setHours(23, 59, 59, 999);
      }

      await createCalendarEvent({
        eventTypeId: targetEventTypeId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        startDate: startD.getTime(),
        endDate: endD.getTime(),
        isAllDay: eventIsAllDay,
        isPrivate: false,
      });

      setEventSuccess("Wydarzenie dodane do kalendarza!");
      setEventTitle("");
      setEventDescription("");
      setTimeout(() => {
        setShowNewEventModal(false);
        setEventSuccess(null);
      }, 1500);
    } catch (err) {
      setEventError(err instanceof Error ? err.message : "Błąd przy dodawaniu wydarzenia.");
    } finally {
      setEventSubmitting(false);
    }
  }





  // If loading user state
  if (me === undefined) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-50">
        <RefreshCw className="size-6 text-[#4dbdc6] animate-spin" />
      </div>
    );
  }

  // If NOT logged in -> Show immediate mobile Login Screen
  if (me === null) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-slate-50 justify-center items-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] max-w-md mx-auto select-none">
        <div className="w-full bg-white rounded-3xl p-6 border border-gray-200 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="size-14 rounded-2xl bg-[#4dbdc6] text-white flex items-center justify-center font-extrabold text-xl mx-auto shadow-md">
              ADK
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">Aplikacja ADK Okna</h1>
            <p className="text-xs text-slate-400">Zaloguj się swoimi danymi z panelu /admin</p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Login / E-mail</label>
              <input
                type="text"
                required
                placeholder="Wpisz login..."
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Hasło</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-3.5 rounded-xl bg-[#4dbdc6] text-white font-bold text-xs shadow-md hover:bg-[#3caab3] disabled:opacity-50 transition flex items-center justify-center gap-2 mt-2"
            >
              {loginSubmitting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 text-gray-900 select-none relative overflow-hidden">
      {/* Top Mobile Bar - Fixed/Static Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] shrink-0 sticky top-0 z-50 flex items-center justify-between">
        {activeTab === "add-document" ? (
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("home");
                resetForm();
              }}
              className="p-1 rounded-full text-slate-600 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="size-5" />
            </button>
            <span className="font-bold text-slate-800 text-sm">Dodaj dokument / zdjęcie</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-[#4dbdc6] text-white flex items-center justify-center font-bold text-xs">
              ADK
            </div>
            <span className="font-bold text-slate-800 text-sm">Aplikacja Mobilna</span>
          </div>
        )}

      </header>

      {/* MODAL 1: Zgłoś Reklamację (Full Screen Top-aligned for Mobile Keyboards) */}
      {showNewComplaintModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] border-b border-gray-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="size-5" />
              <h3 className="font-extrabold text-slate-900 text-base">Zgłoszenie Reklamacji</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowNewComplaintModal(false)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-white border border-gray-200"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Form Content Scrollable Area starting from top */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">


            {complaintSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-emerald-800 text-xs font-bold space-y-2">
                <CheckCircle className="size-8 text-emerald-500 mx-auto" />
                <p>{complaintSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleCreateComplaintSubmit} className="space-y-4">
                {complaintError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{complaintError}</span>
                  </div>
                )}

                {/* Step 1: Select Client */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">1. Wybierz Klienta *</label>
                  <input
                    type="text"
                    placeholder="Szukaj po nazwisku..."
                    value={complaintClientSearch}
                    onChange={(e) => {
                      setComplaintClientSearch(e.target.value);
                      if (complaintSelectedClientId) setComplaintSelectedClientId(null);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                  />

                  {complaintSearchResults && complaintSearchResults.length > 0 && !complaintSelectedClientId && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50">
                      {complaintSearchResults.map((c) => {
                        const name = c.clientType === "business" && c.companyName ? c.companyName : `${c.lastName} ${c.firstName}`;
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setComplaintSelectedClientId(c._id);
                              setComplaintClientSearch(name);
                              setComplaintSelectedOrderId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-100 border-b border-gray-100 font-semibold text-slate-800"
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 2: Select Order */}
                {complaintSelectedClientId && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">2. Wybierz Zlecenie *</label>
                    {complaintOrders && complaintOrders.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {complaintOrders.map((o) => (
                          <button
                            key={o._id}
                            type="button"
                            onClick={() => setComplaintSelectedOrderId(o._id)}
                            className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                              complaintSelectedOrderId === o._id
                                ? "border-amber-500 bg-amber-50 font-bold text-amber-900"
                                : "border-gray-200 bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span>{o.name ?? "Zlecenie bez nazwy"}</span>
                            {complaintSelectedOrderId === o._id && <CheckCircle className="size-4 text-amber-600" />}
                          </button>
                        ))}
                      </div>
                    ) : complaintOrders === undefined ? (
                      <div className="p-2 text-xs text-slate-400 flex items-center gap-2">
                        <RefreshCw className="size-3 animate-spin text-amber-500" />
                        <span>Ładowanie zleceń...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                        Ten klient nie ma aktywnych zleceń w systemie. (Reklamacja zostanie powiązana z klientem).
                      </p>
                    )}
                  </div>
                )}

                {/* Step 3: Description (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">3. Opis Usterki (Opcjonalnie)</label>
                  <textarea
                    rows={2}
                    placeholder="Opisz problem (np. pęknięta szyba, nieszczelność...)..."
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                  />
                </div>

                {/* Step 4: Optional Media (Photos / Video) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">4. Załącz Zdjęcia lub Wideo (Opcjonalnie)</label>
                  <input
                    ref={complaintFileRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => handleAddMediaFiles(e.target.files)}
                    className="hidden"
                  />
                  <input
                    ref={complaintCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleAddMediaFiles(e.target.files)}
                    className="hidden"
                  />
                  <input
                    ref={complaintVideoRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={(e) => handleAddMediaFiles(e.target.files)}
                    className="hidden"
                  />

                  {/* Buttons for Camera, Video, File */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => complaintCameraRef.current?.click()}
                      className="flex flex-col items-center justify-center p-2.5 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-amber-50/50 text-slate-600 gap-1 transition"
                    >
                      <Camera className="size-4 text-amber-600" />
                      <span className="text-[10px] font-bold">Zdjęcie</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => complaintVideoRef.current?.click()}
                      className="flex flex-col items-center justify-center p-2.5 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-amber-50/50 text-slate-600 gap-1 transition"
                    >
                      <Video className="size-4 text-amber-600" />
                      <span className="text-[10px] font-bold">Wideo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => complaintFileRef.current?.click()}
                      className="flex flex-col items-center justify-center p-2.5 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-amber-50/50 text-slate-600 gap-1 transition"
                    >
                      <Upload className="size-4 text-amber-600" />
                      <span className="text-[10px] font-bold">Plik / Kilka</span>
                    </button>
                  </div>

                  {/* Selected media files list */}
                  {complaintMediaFiles.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 max-h-32 overflow-y-auto">
                      <div className="text-[10px] font-bold text-slate-500">Załączone media ({complaintMediaFiles.length}):</div>
                      {complaintMediaFiles.map((f, idx) => (
                        <div key={`complaint-media-${idx}`} className="flex items-center justify-between p-2 bg-amber-50/80 rounded-xl border border-amber-200">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {f.type.startsWith("video/") ? (
                              <Video className="size-4 text-amber-600 shrink-0" />
                            ) : (
                              <FileText className="size-4 text-amber-600 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-800 truncate">{f.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMediaFile(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    !complaintSelectedClientId ||
                    complaintSubmitting ||
                    (!complaintSelectedOrderId && (!complaintOrders || complaintOrders.length === 0))
                  }
                  className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-bold text-xs shadow-md hover:bg-amber-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {complaintSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <AlertCircle className="size-4" />}
                  Zarejestruj Reklamację {complaintMediaFiles.length > 0 ? `(${complaintMediaFiles.length} media)` : ""}
                </button>
              </form>
            )}
          </div>
        </div>
      )}



      {/* Modal: Formularz Dodawania Wydarzenia Własnego */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Calendar className="size-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Nowe Wydarzenie Własne</h3>
                <p className="text-[11px] text-slate-400">Dodaj osobisty wpis w kalendarzu</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNewEventModal(false)}
              className="size-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {eventSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3 my-auto">
                <CheckCircle className="size-12 text-emerald-500 mx-auto" />
                <h4 className="font-extrabold text-emerald-800 text-base">{eventSuccess}</h4>
                <p className="text-xs text-emerald-600">Wydarzenie pojawi się w Twoim harmonogramie prac.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateEventSubmit} className="space-y-4">
                {eventError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-700 text-xs">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{eventError}</span>
                  </div>
                )}

                {/* Event Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tytuł wydarzenia *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Spotkanie z dostawcą, Przegląd narzędzi..."
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Event Date & All Day Toggle */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Data *</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer py-2.5">
                      <input
                        type="checkbox"
                        checked={eventIsAllDay}
                        onChange={(e) => setEventIsAllDay(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 size-4"
                      />
                      <span>Cały dzień</span>
                    </label>
                  </div>
                </div>

                {/* Hours if not All Day */}
                {!eventIsAllDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Od godziny</label>
                      <input
                        type="time"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Do godziny</label>
                      <input
                        type="time"
                        value={eventEndTime}
                        onChange={(e) => setEventEndTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Opis (Opcjonalnie)</label>
                  <textarea
                    rows={3}
                    placeholder="Szczegóły wydarzenia..."
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={eventSubmitting || !eventTitle.trim()}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {eventSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <Calendar className="size-4" />}
                  Zapisz Wydarzenie
                </button>
              </form>
            )}
          </div>
        </div>
      )}




      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 pb-24 overflow-y-auto">
        {activeTab === "home" && (
          <div className="flex-1 flex flex-col justify-between space-y-4">
            {/* Top Area: Events schedule for the selected date */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">Harmonogram prac</h2>
                  <p className="text-[11px] font-medium text-slate-500">
                    {selectedScheduleDate
                      ? selectedScheduleDate.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                      : "Wszystkie nadchodzące"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-gray-200">
                    <button
                      onClick={() => setScheduleView("list")}
                      className={`px-3 py-1.5 rounded-lg flex items-center justify-center transition-colors ${scheduleView === "list" ? "bg-white shadow-sm text-[#4dbdc6]" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <List className="size-4" />
                    </button>
                    <button
                      onClick={() => setScheduleView("calendar")}
                      className={`px-3 py-1.5 rounded-lg flex items-center justify-center transition-colors ${scheduleView === "calendar" ? "bg-white shadow-sm text-[#4dbdc6]" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <LayoutGrid className="size-4" />
                    </button>
                  </div>
                  {/* Select Filter User */}
                  <select
                    value={selectedScheduleUserId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedScheduleUserId(val === "all" ? "all" : val ? (val as Id<"users">) : null);
                    }}
                    className="text-xs bg-white border border-gray-200 font-semibold text-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#4dbdc6] shadow-xs"
                  >
                    <option value="">Moje wydarzenia (zalogowany)</option>
                    <option value="all">Wszyscy użytkownicy</option>
                    {allUsersForFilter?.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.displayName ?? u.login ?? "Użytkownik"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>



              {/* Events List / Calendar View */}
              {scheduleView === "calendar" ? (
                <div 
                  className="w-full overflow-hidden -mx-2 sm:mx-0 px-2 sm:px-0" 
                  style={{ height: "max(350px, calc(100vh - 220px))" }}
                >
                  <MobileWeekCalendar items={userSchedule?.items ?? []} />
                </div>
              ) : (() => {
                if (userSchedule === undefined) {
                  return (
                    <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-gray-200">
                      <RefreshCw className="size-5 text-[#4dbdc6] animate-spin" />
                    </div>
                  );
                }

                const items = userSchedule?.items ?? [];
                const filtered = items.filter((item) => {
                  if (!selectedScheduleDate) return true;
                  const d = new Date(item.date);
                  return (
                    d.getFullYear() === selectedScheduleDate.getFullYear() &&
                    d.getMonth() === selectedScheduleDate.getMonth() &&
                    d.getDate() === selectedScheduleDate.getDate()
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center space-y-2">
                      <div className="size-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Wrench className="size-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Brak zaplanowanych prac w tym dniu</p>
                      <p className="text-[11px] text-slate-400">Przesuń kalendarz poniżej, aby wybrać inny dzień.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {filtered.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2 hover:border-[#4dbdc6] transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                item.type === "montaz"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.type === "serwis"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {item.type === "montaz"
                                ? "Montaż"
                                : item.type === "serwis"
                                ? "Serwis"
                                : "Wydarzenie"}
                            </span>

                            {item.date && (
                              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                <Calendar className="size-3 text-slate-400" />
                                {new Date(item.date).toLocaleDateString("pl-PL", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}

                            {item.timeStr && (
                              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                <Clock className="size-3 text-slate-400" />
                                {item.timeStr}
                              </span>
                            )}
                          </div>
                        </div>


                        <div>
                          {item.clientName !== "Wydarzenie własne" && (
                            <h3 className="font-extrabold text-slate-800 text-sm">{item.clientName}</h3>
                          )}
                          <p className="text-xs text-slate-600 font-semibold">{item.title}</p>
                        </div>


                        {item.address && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium pt-1 border-t border-gray-100">
                      <MapPin className="size-3 text-[#4dbdc6] shrink-0" />
                            <span className="truncate">{item.address}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Swipeable Calendar Strip right above the bottom navigation */}
            {scheduleView === "list" && (
              <div className="sticky bottom-0 z-10 pt-2 pb-1 bg-slate-50">
                <DateStrip
                  selectedDate={selectedScheduleDate}
                  onSelectDate={setSelectedScheduleDate}
                  markedDates={(userSchedule?.items ?? []).map((i) => i.date)}
                />
              </div>
            )}
          </div>
        )}




        {activeTab === "search" && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-slate-800">Wyszukiwarka</h1>
            <p className="text-xs text-slate-500">Szukaj zleceń i klientów.</p>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-slate-800">Powiadomienia</h1>
            <p className="text-xs text-slate-500">Brak nowych powiadomień.</p>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-slate-800">Mój Profil</h1>

            {me ? (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-2xl bg-[#4dbdc6] text-white font-extrabold text-lg flex items-center justify-center">
                    {userFirstName ? userFirstName[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{me.displayName ?? "Użytkownik"}</h3>
                    <p className="text-xs text-slate-400">{me.login}</p>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">

                      <ShieldCheck className="size-3" />
                      Zalogowany (rola: {me.role ?? "użytkownik"})
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition flex items-center justify-center gap-2"
                >
                  <LogOut className="size-4" />
                  Wyloguj się
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 text-sm">Zaloguj się danymi z /admin</h3>
                  <p className="text-xs text-slate-400">
                    Zaloguj się swoim e-mailem i hasłem administratora/pracownika.
                  </p>
                </div>

                {loginError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">E-mail / Login</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@adkokna.pl"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Hasło</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full py-3 rounded-xl bg-[#4dbdc6] text-white font-bold text-xs shadow-md hover:bg-[#3caab3] disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {loginSubmitting ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    Zaloguj się
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* FULL PAGE: Add Document / Photo View */}
        {activeTab === "add-document" && (
          <div className="space-y-5 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            {result && result.ok ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
                <CheckCircle className="size-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-emerald-800 text-base">Dokument przesłany pomyślnie!</h4>
                <p className="text-xs text-emerald-600">
                  Plik został przypisany i wyeksportowany na Dysk Google.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition"
                  >
                    Wgraj kolejny dokument
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("home");
                      resetForm();
                    }}
                    className="w-full py-2.5 rounded-xl border border-emerald-300 text-emerald-800 font-semibold text-xs hover:bg-emerald-100/50 transition"
                  >
                    Wróć do ekranu głównego
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {result && !result.ok && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2 text-rose-700 text-xs">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{result.error}</span>
                  </div>
                )}

                {/* Step 1: Select Client */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">1. Wybierz Klienta *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Wpisz nazwisko lub firmę..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                        if (selectedClientId) setSelectedClientId(null);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-3 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                    />
                    {clientSearch && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {showClientDropdown && searchResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                      {searchResults.map((client) => {
                        const name =
                          client.clientType === "business" && client.companyName
                            ? client.companyName
                            : `${client.lastName} ${client.firstName}`.trim();
                        return (
                          <button
                            key={client._id}
                            type="button"
                            onClick={() => selectClient(client._id, name)}
                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-100 flex items-center justify-between border-b border-gray-100 last:border-0"
                          >
                            <span className="font-semibold text-slate-800">{name}</span>
                            {client.city && <span className="text-[10px] text-slate-400">{client.city}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 2: Select Order */}
                {selectedClientId && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">2. Wybierz Zlecenie *</label>
                    {orders && orders.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {orders.map((o) => {
                          const isSelected = selectedOrderId === o._id;
                          const statusStr = statusMap[o.status] ?? o.status;
                          return (
                            <button
                              key={o._id}
                              type="button"
                              onClick={() => setSelectedOrderId(isSelected ? null : o._id)}
                              className={`w-full text-left p-3 rounded-xl border text-xs transition flex items-center justify-between ${
                                isSelected
                                  ? "border-[#4dbdc6] bg-[#4dbdc6]/10 text-slate-900 font-semibold"
                                  : "border-gray-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div>
                                <div className="font-bold text-slate-800">{o.name ?? "Zlecenie bez nazwy"}</div>
                                {o.customText && (
                                  <div className="text-[11px] text-[#4dbdc6] font-medium mt-0.5">{o.customText}</div>
                                )}
                              </div>
                              {isSelected && <CheckCircle className="size-4 text-[#4dbdc6]" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Brak otwartych zleceń dla tego klienta.</p>
                    )}
                  </div>
                )}

                {/* Step 3: Choose Upload Mode & Content */}
                {selectedOrderId && (
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">3. Wybierz miejsce / sposób wgrywania *</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setUploadTargetMode("replace_doc")}
                          className={`py-2 px-2 text-[11px] font-bold rounded-lg transition text-center ${
                            uploadTargetMode === "replace_doc"
                              ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          Podmień dokument systemowy
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadTargetMode("drive_browser")}
                          className={`py-2 px-2 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                            uploadTargetMode === "drive_browser"
                              ? "bg-[#4dbdc6] text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <Folder className="size-3.5" />
                          Foldery zlecenia w Drive
                        </button>
                      </div>
                    </div>

                    {uploadTargetMode === "drive_browser" ? (
                      <div className="space-y-4 pt-2">
                        {/* Status Messages */}
                        {driveSuccessMsg && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-bold flex items-center justify-between shadow-xs">
                            <span>{driveSuccessMsg}</span>
                            <button type="button" onClick={() => setDriveSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 p-0.5">
                              <X className="size-4" />
                            </button>
                          </div>
                        )}

                        {driveErrorMsg && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>{driveErrorMsg}</span>
                          </div>
                        )}

                        {/* Step 4: Folder Selection */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            4. Wybierz folder docelowy w Google Drive *
                          </label>
                          <OrderDriveBrowser
                            orderId={selectedOrderId}
                            rootFolderId={selectedOrder?.folderId}
                            previewSide="right"
                            onFolderChange={setActiveDriveFolder}
                            refreshKey={driveRefreshKey}
                            hideDropZone={true}
                            hideHeaderButtons={true}
                            disableSidePreview={true}
                          />
                        </div>

                        {/* Step 5: Photo Capture & Scanner Box */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                          <label className="block text-xs font-bold text-slate-700">
                            5. Zrób Zdjęcie lub Wybierz Plik (Wyślij do: "{activeDriveFolder?.name ?? "Folder główny zlecenia"}") *
                          </label>

                          {/* Hidden inputs */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleScanPhotoSelect}
                            className="hidden"
                          />
                          <input
                            ref={scanCameraAddRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleScanPhotoSelect}
                            className="hidden"
                          />

                          {/* Mode A: single file selected */}
                          {file && scanPages.length === 0 ? (
                            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <FileText className="size-5 text-[#4dbdc6] shrink-0" />
                                <span className="text-xs font-semibold text-slate-700 truncate">{file.name}</span>
                              </div>
                              <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : scanPages.length > 0 ? (
                            /* Mode B: scanner grid */
                            <div className="space-y-2">
                              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={scanPreviews} strategy={rectSortingStrategy}>
                                  <div className="grid grid-cols-3 gap-2">
                                    {scanPreviews.map((src, idx) => (
                                      <SortablePhotoItem
                                        key={src}
                                        id={src}
                                        src={src}
                                        index={idx}
                                        rotation={scanRotations[idx] || 0}
                                        onRemove={handleRemoveScanPage}
                                        onRotate={handleRotateScanPage}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>

                              {scanPages.length < 20 && (
                                <button
                                  type="button"
                                  onClick={() => scanCameraAddRef.current?.click()}
                                  className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-[#4dbdc6] rounded-xl text-[#4dbdc6] text-xs font-bold bg-white hover:bg-[#4dbdc6]/5 transition"
                                >
                                  <Camera className="size-4" />
                                  + Dodaj kolejną stronę ({scanPages.length}/20)
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => { setScanPages([]); setScanPreviews([]); setScanRotations([]); }}
                                className="w-full text-[10px] text-slate-400 hover:text-red-500 transition py-1"
                              >
                                ✕ Usuń wszystkie strony i zacznij od nowa
                              </button>
                            </div>
                          ) : (
                            /* Mode C: Action Buttons */
                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-slate-100 text-slate-700 gap-1 transition"
                              >
                                <Camera className="size-5 text-[#4dbdc6]" />
                                <span className="text-xs font-bold">Zrób zdjęcie</span>
                                <span className="text-[9px] text-slate-400">skaner → PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-slate-100 text-slate-700 gap-1 transition"
                              >
                                <Upload className="size-5 text-[#4dbdc6]" />
                                <span className="text-xs font-bold">Wybierz plik</span>
                                <span className="text-[9px] text-slate-400">PDF lub obraz</span>
                              </button>
                            </div>
                          )}

                          {/* Custom File Name Input */}
                          {(file || scanPages.length > 0) && (
                            <div className="space-y-1 pt-1">
                              <label className="text-[11px] font-bold text-slate-700">Nazwa pliku w Google Drive (opcjonalnie)</label>
                              <input
                                type="text"
                                placeholder={scanPages.length > 0 ? "Zdjecie_2026-09-08_08-35.pdf" : (file?.name ?? "Moja_Nazwa.pdf")}
                                value={driveCustomFileName}
                                onChange={(e) => setDriveCustomFileName(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none bg-white"
                              />
                            </div>
                          )}

                          {/* Send Button to Active Folder */}
                          <button
                            type="button"
                            onClick={handleDriveFileUpload}
                            disabled={(!file && scanPages.length === 0) || driveUploading}
                            className="w-full py-3.5 rounded-xl bg-[#4dbdc6] text-white font-bold text-xs shadow-md hover:bg-[#3caab3] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                          >
                            {driveUploading ? (
                              <>
                                <RefreshCw className="size-4 animate-spin" />
                                Wgrywanie do folderu "{activeDriveFolder?.name ?? "Drive"}"...
                              </>
                            ) : (
                              <>
                                <Upload className="size-4" />
                                Wyślij do folderu: {activeDriveFolder?.name ?? "Folder główny zlecenia"}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Step 3a: Document Type */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Typ Dokumentu (Wybierz wygenerowany dokument do podmiany) *</label>
                          {availableDocumentTypes.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Brak wygenerowanych dokumentów w tym zleceniu.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {availableDocumentTypes.map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setDocumentType(t.id)}
                                  className={`p-3 text-xs rounded-xl border text-left transition ${
                                    documentType === t.id
                                      ? "border-[#4dbdc6] bg-[#4dbdc6]/10 text-slate-900 font-bold"
                                      : "border-gray-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Step 4: Photo / File Input buttons */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">4. Wybierz Plik lub Zrób Zdjęcie *</label>

                          {/* Hidden inputs */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleScanPhotoSelect}
                            className="hidden"
                          />
                          {/* Hidden input for adding extra scan pages */}
                          <input
                            ref={scanCameraAddRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleScanPhotoSelect}
                            className="hidden"
                          />

                          {/* Mode A: single file selected from disk */}
                          {file && scanPages.length === 0 ? (
                            <div className="flex items-center justify-between p-3.5 bg-slate-100 rounded-xl border border-slate-200">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <FileText className="size-5 text-[#4dbdc6] shrink-0" />
                                <span className="text-xs font-semibold text-slate-700 truncate">{file.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFile(null)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : scanPages.length > 0 ? (
                            /* Mode B: scanner — one or more photos */
                            <div className="space-y-2">
                              {/* Page thumbnails grid */}
                              <DndContext 
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext 
                                  items={scanPreviews}
                                  strategy={rectSortingStrategy}
                                >
                                  <div className="grid grid-cols-3 gap-2">
                                    {scanPreviews.map((src, idx) => (
                                      <SortablePhotoItem
                                        key={src}
                                        id={src}
                                        src={src}
                                        index={idx}
                                        rotation={scanRotations[idx] || 0}
                                        onRemove={handleRemoveScanPage}
                                        onRotate={handleRotateScanPage}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>

                              {/* Add page button (max 20 pages) */}
                              {scanPages.length < 20 && (
                                <button
                                  type="button"
                                  onClick={() => scanCameraAddRef.current?.click()}
                                  className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-[#4dbdc6] rounded-xl text-[#4dbdc6] text-xs font-bold hover:bg-[#4dbdc6]/5 transition"
                                >
                                  <Camera className="size-4" />
                                  + Dodaj stronę ({scanPages.length}/20)
                                </button>
                              )}

                              {/* Clear all */}
                              <button
                                type="button"
                                onClick={() => { setScanPages([]); setScanPreviews([]); setScanRotations([]); }}
                                className="w-full text-[10px] text-slate-400 hover:text-red-500 transition py-1"
                              >
                                ✕ Usuń wszystkie strony i zacznij od nowa
                              </button>
                            </div>
                          ) : (
                            /* Mode C: initial — no file, no pages */
                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 gap-1.5 transition"
                              >
                                <Camera className="size-6 text-[#4dbdc6]" />
                                <span className="text-xs font-bold">Zrób zdjęcie</span>
                                <span className="text-[9px] text-slate-400">wiele stron → PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 gap-1.5 transition"
                              >
                                <Upload className="size-6 text-[#4dbdc6]" />
                                <span className="text-xs font-bold">Wybierz plik</span>
                                <span className="text-[9px] text-slate-400">PDF lub obraz</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={!selectedClientId || !selectedOrderId || (!file && scanPages.length === 0) || uploading}
                          className="w-full py-3.5 rounded-xl bg-[#4dbdc6] text-white font-bold text-xs shadow-md hover:bg-[#3caab3] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-4"
                        >
                          {uploading ? (
                            <>
                              <RefreshCw className="size-4 animate-spin" />
                              {scanPages.length > 0 ? `Łączenie ${scanPages.length} str. w PDF...` : "Wgrywanie do Dysk Google..."}
                            </>
                          ) : (
                            <>
                              <Upload className="size-4" />
                              {scanPages.length > 0 ? `Wyślij PDF (${scanPages.length} str.)` : "Wyślij dokument"}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="relative flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {/* Home */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "home" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Home className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Home</span>
          </button>

          {/* Search */}
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "search" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Search className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Search</span>
          </button>

          {/* Center Floating (+) Button for Quick Choice Menu */}
          <div className="flex-1 flex items-center justify-center relative -top-5">
            <button
              type="button"
              onClick={() => setShowBubbleMenu((prev) => !prev)}
              className={`size-13 rounded-2xl text-white flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                showBubbleMenu ? "bg-slate-800 rotate-45" : "bg-[#4dbdc6] hover:bg-[#3caab3]"
              }`}
              title="Otwórz menu Szybki wybór"
            >
              <Plus className="size-7 stroke-[2.5]" />
            </button>

            {/* Animated Bubble Pop-over Menu attached to (+) button */}
            {showBubbleMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
                  onClick={() => setShowBubbleMenu(false)}
                />
                <div className="absolute bottom-16 z-50 bg-white rounded-3xl p-3 shadow-2xl border border-gray-100 flex flex-col gap-2 min-w-[220px] animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-200">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 pt-1 text-center">
                    Szybki wybór
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowBubbleMenu(false);
                      setActiveTab("add-document");
                      resetForm();
                    }}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-teal-50 text-teal-900 hover:bg-teal-100 font-bold text-xs transition text-left"
                  >
                    <div className="size-8 rounded-xl bg-[#4dbdc6] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <div className="font-extrabold">Dodaj Dokument / Zdjęcie</div>
                      <div className="text-[10px] font-normal text-teal-700">Skan, umowa, protokół...</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowBubbleMenu(false);
                      setShowNewEventModal(true);
                    }}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 text-indigo-900 hover:bg-indigo-100 font-bold text-xs transition text-left"
                  >
                    <div className="size-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Calendar className="size-4" />
                    </div>
                    <div>
                      <div className="font-extrabold">Wydarzenie własne</div>
                      <div className="text-[10px] font-normal text-indigo-700">Dodaj do kalendarza</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowBubbleMenu(false);
                      setShowNewComplaintModal(true);
                    }}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-xs transition text-left"
                  >
                    <div className="size-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="size-4" />
                    </div>
                    <div>
                      <div className="font-extrabold">Zgłoś Reklamację</div>
                      <div className="text-[10px] font-normal text-amber-700">Nowy wpis + wideo/zdjęcia</div>
                    </div>
                  </button>



                </div>
              </>
            )}
          </div>


          {/* Notifications */}
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "notifications" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Bell className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Notifications</span>
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "profile" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <User className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
