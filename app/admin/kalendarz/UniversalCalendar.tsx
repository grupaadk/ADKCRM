"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventClickArg, EventDropArg, EventContentArg, DatesSetArg, DateSelectArg } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import type { Id } from "@/convex/_generated/dataModel";
import { useStatuses } from "@/components/StatusLabelsContext";
import { FilterX, CheckCheck, Search, X, Car } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const DEFAULT_START_HOUR = 8;
const EVENT_DURATION_HOURS = 1;

function minsToDate(baseDate: number, mins: number): Date {
  const d = new Date(baseDate);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function dateToMins(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

function fmtWeekRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

function fmtDateTime(d: Date) {
  const day = d.getDate().toString().padStart(2, "0");
  const mon = (d.getMonth() + 1).toString().padStart(2, "0");
  const yr = d.getFullYear();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${day}.${mon}.${yr} ${h}:${m}`;
}

const VIEW_LABELS: Record<string, string> = {
  dayGridMonth: "Miesiąc",
  timeGridWeek: "Tydzień",
  timeGridDay: "Dzień",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function UniversalCalendar({
  initialTeamId,
  initialView = "timeGridWeek",
}: {
  initialTeamId?: Id<"installationTeams">;
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay";
} = {}) {
  const calendarRef = useRef<FullCalendar>(null);
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null);
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay">("timeGridWeek");
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUserFilters, setActiveUserFilters] = useState<Set<string>>(new Set());
  const [activeEventTypeFilters, setActiveEventTypeFilters] = useState<Set<string>>(new Set());
  const [activeSupplierFilters, setActiveSupplierFilters] = useState<Set<string>>(new Set());
  const [activeTeamFilters, setActiveTeamFilters] = useState<Set<string>>(
    () => (initialTeamId ? new Set([initialTeamId]) : new Set())
  );
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showMoreSuppliersDropdown, setShowMoreSuppliersDropdown] = useState(false);
  const [showMoreTeamsDropdown, setShowMoreTeamsDropdown] = useState(false);
  const [activeCarFilters, setActiveCarFilters] = useState<Set<string>>(new Set());
  const [carsInitialized, setCarsInitialized] = useState(false);
  const [showCarFilterDropdown, setShowCarFilterDropdown] = useState(false);
  const [showUserFilterDropdown, setShowUserFilterDropdown] = useState(false);
  const [showPrivate, setShowPrivate] = useState(true);

  // Modals
  const [dayEventsListModalOpen, setDayEventsListModalOpen] = useState(false);
  const [dayEventsViewMode, setDayEventsViewMode] = useState<"timeline" | "list">("timeline");
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // New event / installation date state
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventMode, setNewEventMode] = useState<"event" | "montaz">("event");
  const [selectedOrderIdForMontaz, setSelectedOrderIdForMontaz] = useState<string>("");
  const [orderSearchQueryForMontaz, setOrderSearchQueryForMontaz] = useState<string>("");
  const [selectedTeamIdForMontaz, setSelectedTeamIdForMontaz] = useState<string>("");
  const [montazNote, setMontazNote] = useState<string>("");
  const [newEventTypeId, setNewEventTypeId] = useState<string>("");
  const [newEventStartDate, setNewEventStartDate] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("09:00");
  const [newEventEndDate, setNewEventEndDate] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("10:00");
  const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);
  const [newEventIsPrivate, setNewEventIsPrivate] = useState(false);
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventAssignedUserIds, setNewEventAssignedUserIds] = useState<string[]>([]);

  // Event detail modal
  const [detailEvent, setDetailEvent] = useState<{
    id: string;
    type: "montaz" | "event";
    clientId?: string;
    orderId?: string;
    title: string;
    color: string;
    start?: Date | null;
    end?: Date | null;
    description?: string;
    isPrivate?: boolean;
    eventTypeName?: string;
    assignedUserNames?: string[];
    assignedUsers?: Array<{ id?: string; name?: string; color?: string }>;
  } | null>(null);

  // Confirm delete modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Supplier Dropdown state
  const [openSupplierDropdownId, setOpenSupplierDropdownId] = useState<string | null>(null);

  // Team Dropdown state
  const [openTeamDropdownId, setOpenTeamDropdownId] = useState<string | null>(null);

  // Tooltip
  const [tooltip, setTooltip] = useState<{
    visible: boolean; x: number; y: number; content: React.ReactNode;
  }>({ visible: false, x: 0, y: 0, content: null });

  // Convex data
  const allOrders = useQuery(api.orders.listForPicker);
  const currentUser = useQuery(api.users.me);
  const allUsers = useQuery(api.users.listAllActive);
  const activeSuppliers = useQuery(api.suppliers.listActive) ?? [];
  const installationTeams = useQuery(api.installationTeams.listActive) ?? [];
  const eventTypes = useQuery(api.calendarEvents.getEventTypes) ?? [];

  const [eventTypesInitialized, setEventTypesInitialized] = useState(false);
  useEffect(() => {
    if (eventTypes && eventTypes.length > 0 && !eventTypesInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveEventTypeFilters(new Set(eventTypes.map((t) => t._id)));
      setEventTypesInitialized(true);
    }
  }, [eventTypes, eventTypesInitialized]);

  const [suppliersInitialized, setSuppliersInitialized] = useState(false);
  useEffect(() => {
    if (activeSuppliers && activeSuppliers.length > 0 && !suppliersInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSupplierFilters(new Set(activeSuppliers.map((s) => s._id)));
      setSuppliersInitialized(true);
    }
  }, [activeSuppliers, suppliersInitialized]);

  const [teamsInitialized, setTeamsInitialized] = useState(false);
  useEffect(() => {
    if (initialTeamId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTeamFilters(new Set([initialTeamId]));
    } else if (installationTeams && installationTeams.length > 0 && !teamsInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTeamFilters(new Set(installationTeams.map((t) => t._id)));
      setTeamsInitialized(true);
    }
  }, [initialTeamId, installationTeams, teamsInitialized]);
  const cars = useQuery(api.cars.getCars);
  useEffect(() => {
    if (cars && cars.length > 0 && !carsInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCarFilters(new Set(cars.map((c) => c._id)));
      setCarsInitialized(true);
    }
  }, [cars, carsInitialized]);

  const wlasneType = eventTypes.find((t) => t.name.toLowerCase() === "własne" || t.name.toLowerCase() === "wlasne");
  const defaultEventTypeId = wlasneType ? wlasneType._id : (eventTypes[0]?._id || "");
  const effectiveEventTypeId = newEventTypeId || defaultEventTypeId;
  const calendarEvents = useQuery(api.calendarEvents.getEvents, {
    startDate: visibleRange.start.getTime(),
    endDate: visibleRange.end.getTime(),
  });
  const linkedOrderEvents = useQuery(api.calendarEvents.getLinkedOrderEvents, {
    startDate: visibleRange.start.getTime(),
    endDate: visibleRange.end.getTime(),
  });

  const updateOrder = useMutation(api.orders.update);
  const createCalendarEvent = useMutation(api.calendarEvents.createEvent);
  const deleteCalendarEvent = useMutation(api.calendarEvents.deleteEvent);
  const updateCalendarEvent = useMutation(api.calendarEvents.updateEvent);
  const updateLinkedOrderDate = useMutation(api.calendarEvents.updateLinkedOrderDate);
  const ensureSupplierEventTypes = useMutation(api.calendarEvents.ensureSupplierEventTypes);

  useEffect(() => {
    ensureSupplierEventTypes().catch(() => {});
  }, [ensureSupplierEventTypes]);

  const statuses = useStatuses();
  const statusColorByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of statuses) m[s.key] = s.color;
    return m;
  }, [statuses]);

  // Load persisted filters
  useEffect(() => {
    if (!currentUser?._id) return;
    try {
      const saved = localStorage.getItem(`montaz_user_filter_${currentUser._id}`);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) setTimeout(() => setActiveUserFilters(new Set(arr)), 0);
      }
    } catch {}
  }, [currentUser?._id]);


  const toggleUserFilter = (id: string) => {
    setActiveUserFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (currentUser?._id) {
        localStorage.setItem(`montaz_user_filter_${currentUser._id}`, JSON.stringify([...next]));
      }
      return next;
    });
  };

  const toggleEventTypeFilter = (id: string) => {
    setActiveEventTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const suppliersFromTypes = useMemo(() => {
    const map = new Map<string, { id: string; name: string; typeIds: string[]; color: string }>();
    eventTypes.forEach((t) => {
      if (t.linkedSupplierId && t.linkedSupplierName) {
        if (!map.has(t.linkedSupplierId)) {
          map.set(t.linkedSupplierId, {
            id: t.linkedSupplierId,
            name: t.linkedSupplierName,
            typeIds: [t._id],
            color: t.color,
          });
        } else {
          map.get(t.linkedSupplierId)!.typeIds.push(t._id);
        }
      }
    });
    return Array.from(map.values());
  }, [eventTypes]);

  const toggleSupplierFilter = (supplierId: string) => {
    setActiveSupplierFilters((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  };

  const toggleTeamFilter = (teamId: string) => {
    setActiveTeamFilters((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  // ─── Build unified events ───────────────────────────────────────────────────

  // ─── Build unified events ───────────────────────────────────────────────────

  const events = useMemo(() => {
    const result: object[] = [];

    const hasActiveEventTypeFilters = activeEventTypeFilters.size > 0;
    const hasActiveSupplierFilters = activeSupplierFilters.size > 0;
    const hasActiveTeamFilters = activeTeamFilters.size > 0;
    const hasActiveUserFilters = activeUserFilters.size > 0;
    const hasActiveCarFilters = activeCarFilters.size > 0;

    // Jeśli żaden filtr nie jest zaznaczony, kalendarz jest pusty
    const isAnyFilterActive =
      hasActiveEventTypeFilters ||
      hasActiveSupplierFilters ||
      hasActiveTeamFilters ||
      hasActiveUserFilters ||
      hasActiveCarFilters;

    if (!isAnyFilterActive) {
      return result;
    }

    const matchesFilters = (params: {
      eventTypeId: string;
      supplierId?: string;
      installationTeamId?: string;
      carId?: string | null;
      assignedUserIds?: string[];
      assignedUserId?: string;
      title?: string;
      orderName?: string;
      clientName?: string;
      customText?: string;
      city?: string;
    }) => {
      // Wyszukiwarka tekstu (zlecenie / klient / opis / miasto)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (params.title ?? "").toLowerCase().includes(q);
        const orderMatch = (params.orderName ?? "").toLowerCase().includes(q);
        const clientMatch = (params.clientName ?? "").toLowerCase().includes(q);
        const customMatch = (params.customText ?? "").toLowerCase().includes(q);
        const cityMatch = (params.city ?? "").toLowerCase().includes(q);

        if (!titleMatch && !orderMatch && !clientMatch && !customMatch && !cityMatch) {
          return false;
        }
      }

      // Sprawdź czy wydarzenie pasuje do przynajmniej jednego aktywnego kryterium
      let matched = false;

      // Filtr użytkownika (jeśli aktywny)
      if (hasActiveUserFilters) {
        let userMatch = false;
        if (params.assignedUserIds) {
          userMatch =
            params.assignedUserIds.some((uid) => activeUserFilters.has(uid)) ||
            (params.assignedUserIds.length === 0 && activeUserFilters.has("__none__"));
        } else if (params.assignedUserId !== undefined) {
          userMatch = params.assignedUserId
            ? activeUserFilters.has(params.assignedUserId)
            : activeUserFilters.has("__none__");
        }
        if (!userMatch) return false;
        matched = true;
      }
      if (!matched && hasActiveEventTypeFilters && activeEventTypeFilters.has(params.eventTypeId)) {
        matched = true;
      }

      // 2. Pasuje do aktywnego dostawcy
      if (!matched && hasActiveSupplierFilters) {
        if (params.supplierId && activeSupplierFilters.has(params.supplierId)) {
          matched = true;
        } else {
          const et = eventTypes.find((t) => t._id === params.eventTypeId);
          if (et?.linkedSupplierId && activeSupplierFilters.has(et.linkedSupplierId)) {
            matched = true;
          }
        }
      }

      // 3. Pasuje do aktywnej ekipy montażowej
      if (!matched && hasActiveTeamFilters) {
        if (params.installationTeamId && activeTeamFilters.has(params.installationTeamId)) {
          matched = true;
        } else {
          const et = eventTypes.find((t) => t._id === params.eventTypeId);
          if (et?.linkedInstallationTeamId && activeTeamFilters.has(et.linkedInstallationTeamId)) {
            matched = true;
          }
        }
      }

      // 4. Pasuje do aktywnej floty samochodów
      if (!matched && hasActiveCarFilters) {
        if (params.carId && activeCarFilters.has(params.carId)) {
          matched = true;
        } else if (cars) {
          const titleAndDesc = `${params.title ?? ""} ${params.customText ?? ""}`.toLowerCase();
          for (const car of cars) {
            if (
              activeCarFilters.has(car._id) &&
              car.registrationNumber &&
              titleAndDesc.includes(car.registrationNumber.toLowerCase())
            ) {
              matched = true;
              break;
            }
          }
        }
      }

      return matched;
    };

    const userMap = new Map(allUsers?.map((u) => [u._id, u.displayName ?? u.login ?? "Użytkownik"]));

    // --- Calendar events ---
    if (calendarEvents) {
      for (const e of calendarEvents) {
        if (!showPrivate && e.isPrivate) continue;

        const order = e.orderId ? allOrders?.find((o) => o._id === e.orderId) : undefined;
        const teamId =
          e.installationTeamId ??
          (order ? (order as { installationTeamId?: string }).installationTeamId : undefined);
        const supplierId = e.eventType?.linkedSupplierId;
        const orderName = (order as { name?: string | null })?.name ?? undefined;

        const assignedUserIds =
          e.assignedUserIds && e.assignedUserIds.length > 0
            ? e.assignedUserIds
            : e.createdBy
            ? [e.createdBy]
            : [];

        const assignedUserNames: string[] = [];
        for (const uid of assignedUserIds) {
          const userName = userMap.get(uid as Id<"users">);
          if (userName) assignedUserNames.push(userName);
        }
        if (assignedUserNames.length === 0 && Array.isArray(e.assignedUsers)) {
          for (const u of e.assignedUsers as Array<{ name?: string }>) {
            if (u?.name && u.name !== "?") assignedUserNames.push(u.name);
          }
        }

        if (
          !matchesFilters({
            eventTypeId: e.eventTypeId,
            supplierId,
            installationTeamId: teamId,
            carId: (e as { carId?: string | null }).carId,
            assignedUserIds,
            title: e.title,
            orderName,
            customText: e.description,
          })
        ) {
          continue;
        }

        const color = e.eventType?.color ?? "#64748b";
        result.push({
          id: e._id,
          title: e.title,
          start: new Date(e.startDate),
          end: e.endDate ? new Date(e.endDate) : undefined,
          allDay: e.isAllDay,
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: {
            sourceType: "event",
            eventTypeId: e.eventTypeId,
            eventTypeName: e.eventType?.name ?? "Zdarzenie",
            color,
            description: e.description,
            isPrivate: e.isPrivate,
            assignedUsers: e.assignedUsers,
            assignedUserNames,
            clientId: e.clientId,
            orderId: e.orderId,
          },
        });
      }
    }

    // --- Linked Order events ---
    if (linkedOrderEvents) {
      for (const le of linkedOrderEvents) {
        if (
          !matchesFilters({
            eventTypeId: le.eventTypeId,
            supplierId: le.supplierId,
            installationTeamId: le.installationTeamId,
            assignedUserId: le.assignedUserId,
            title: le.customText,
            orderName: le.orderName,
            clientName: le.clientName,
            customText: le.serviceName,
          })
        ) {
          continue;
        }

        const baseText = le.orderName ? `${le.orderName} - ${le.clientName}` : le.clientName;
        const customPart = le.customText ? ` [${le.customText}]` : "";
        const servicePart = le.serviceName ? ` (${le.serviceName})` : "";
        const titleText = `${baseText}${customPart}${servicePart}`;

        result.push({
          id: le.id,
          title: titleText,
          start: new Date(le.startDate),
          end: (le as { endDate?: number }).endDate ? new Date((le as { endDate?: number }).endDate!) : undefined,
          allDay: !le.hasTime,
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: {
            sourceType: "order-linked",
            orderId: le.orderId,
            complaintId: (le as { complaintId?: string }).complaintId,
            serviceDateOffset: (le as { serviceDateOffset?: number }).serviceDateOffset,
            clientId: le.clientId,
            clientName: le.clientName,
            orderName: le.orderName,
            customText: le.customText,
            serviceName: le.serviceName,
            supplierId: le.supplierId,
            supplierName: le.supplierName,
            installationTeamId: le.installationTeamId,
            installationTeamName: le.installationTeamName,
            installationTeamColor: le.installationTeamColor,
            field: le.field,
            deliveryIndex: le.deliveryIndex,
            installationIndex: (le as { installationIndex?: number }).installationIndex,
            eventTypeId: le.eventTypeId,
            eventTypeName: le.eventTypeName,
            color: le.color,
          },
        });
      }
    }

    return result;
  }, [
    calendarEvents,
    linkedOrderEvents,
    activeUserFilters,
    activeEventTypeFilters,
    activeSupplierFilters,
    activeTeamFilters,
    activeCarFilters,
    cars,
    showPrivate,
    allOrders,
    allUsers,
    eventTypes,
    searchQuery,
  ]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleDatesSet = (info: DatesSetArg) => {
    setVisibleRange({ start: info.start, end: info.end });
    setYear(info.view.currentStart.getFullYear());
    setMonth(info.view.currentStart.getMonth());
    if (info.view.type === "timeGridWeek" || info.view.type === "timeGridDay") {
      const displayEnd = new Date(info.end.getTime() - 1);
      setWeekRange({ start: info.view.currentStart, end: displayEnd });
    } else {
      setWeekRange(null);
    }
  };

  const handleEventDrop = async (info: EventDropArg) => {
    const props = info.event.extendedProps as {
      sourceType: string;
      orderId?: string;
      complaintId?: string;
      serviceDateOffset?: number;
      field?: string;
      deliveryIndex?: number;
    };
    const newStart = info.event.start;
    const newEnd = info.event.end;
    if (!newStart) return;

    if (props.sourceType === "montaz") {
      await updateOrder({
        orderId: info.event.id as Id<"orders">,
        projectEndDate: localMidnight(newStart),
        installationStartDate: dateToMins(newStart),
      });
    } else if (props.sourceType === "order-linked" && (props.orderId || props.complaintId) && props.field) {
      // Compute new serviceDateEnd if this is a complaint service event with a known duration
      const newServiceDateEnd =
        props.field === "complaintServiceDate" && props.serviceDateOffset !== undefined
          ? newStart.getTime() + props.serviceDateOffset
          : undefined;

      await updateLinkedOrderDate({
        orderId: props.orderId ? (props.orderId as Id<"orders">) : undefined,
        complaintId: props.complaintId ? (props.complaintId as Id<"complaints">) : undefined,
        field: props.field,
        deliveryIndex: props.deliveryIndex,
        installationIndex: props.installationIndex,
        newDate: newStart.getTime(),
        endDate: newEnd ? newEnd.getTime() : undefined,
        serviceDateEnd: newServiceDateEnd,
      });
    } else {
      await updateCalendarEvent({
        id: info.event.id as Id<"calendarEvents">,
        startDate: newStart.getTime(),
        endDate: newEnd ? newEnd.getTime() : undefined,
        isAllDay: info.event.allDay,
      });
    }
  };

  const handleEventResize = async (info: EventResizeDoneArg) => {
    const props = info.event.extendedProps as {
      sourceType: string;
      orderId?: string;
      complaintId?: string;
      field?: string;
      deliveryIndex?: number;
      installationIndex?: number;
    };
    const newStart = info.event.start;
    const newEnd = info.event.end;
    if (!newStart) return;

    if (props.sourceType === "montaz") {
      await updateOrder({
        orderId: info.event.id as Id<"orders">,
        projectEndDate: localMidnight(newStart),
        installationStartDate: dateToMins(newStart),
      });
    } else if (props.sourceType === "order-linked" && (props.orderId || props.complaintId) && props.field) {
      await updateLinkedOrderDate({
        orderId: props.orderId ? (props.orderId as Id<"orders">) : undefined,
        complaintId: props.complaintId ? (props.complaintId as Id<"complaints">) : undefined,
        field: props.field,
        deliveryIndex: props.deliveryIndex,
        installationIndex: props.installationIndex,
        newDate: newStart.getTime(),
        endDate: newEnd ? newEnd.getTime() : undefined,
        serviceDateEnd: newEnd ? newEnd.getTime() : undefined,
      });
    } else {
      await updateCalendarEvent({
        id: info.event.id as Id<"calendarEvents">,
        startDate: newStart.getTime(),
        endDate: newEnd ? newEnd.getTime() : undefined,
        isAllDay: info.event.allDay,
      });
    }
  };

  const handleUpdateEventTime = async (
    evProps: { id?: string; extendedProps: Record<string, unknown> },
    timeStr: string
  ) => {
    if (!selectedDate || !timeStr) return;
    const [h, m] = timeStr.split(":").map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(h, m, 0, 0);

    const props = evProps.extendedProps as {
      sourceType: string;
      orderId?: string;
      complaintId?: string;
      field?: string;
      deliveryIndex?: number;
    };

    if (props.sourceType === "order-linked" && (props.orderId || props.complaintId) && props.field) {
      await updateLinkedOrderDate({
        orderId: props.orderId ? (props.orderId as Id<"orders">) : undefined,
        complaintId: props.complaintId ? (props.complaintId as Id<"complaints">) : undefined,
        field: props.field,
        deliveryIndex: props.deliveryIndex,
        newDate: newDate.getTime(),
      });
    } else if (evProps.id) {
      await updateCalendarEvent({
        id: evProps.id as Id<"calendarEvents">,
        startDate: newDate.getTime(),
        isAllDay: false,
      });
    }
  };

  const handleEventClick = (info: EventClickArg) => {
    const props = info.event.extendedProps as {
      sourceType: string;
      clientId?: string;
      orderId?: string;
      color?: string;
      description?: string;
      isPrivate?: boolean;
      eventTypeName?: string;
      assignedUserNames?: string[];
      assignedUsers?: Array<{ id?: string; name?: string; color?: string }>;
    };

    if (props.sourceType === "montaz" || props.sourceType === "order-linked") {
      if (props.clientId && props.orderId) {
        window.open(`/admin/klient/${props.clientId}/zlecenie/${props.orderId}`, "_blank");
      }
    } else {
      setDetailEvent({
        id: info.event.id,
        type: "event",
        title: info.event.title,
        color: props.color ?? "#64748b",
        start: info.event.start,
        end: info.event.end,
        description: props.description,
        isPrivate: props.isPrivate,
        eventTypeName: props.eventTypeName,
        clientId: props.clientId,
        orderId: props.orderId,
        assignedUserNames: props.assignedUserNames,
        assignedUsers: props.assignedUsers as Array<{ id?: string; name?: string; color?: string }> | undefined,
      });
    }
  };

  const handleSelect = (info: DateSelectArg) => {
    setSelectedDate(info.start);
    setNewEventMode("event");
    setSelectedOrderIdForMontaz("");
    setOrderSearchQueryForMontaz("");
    setSelectedTeamIdForMontaz("");
    setMontazNote("");
    setNewEventTitle("");
    setNewEventTypeId(defaultEventTypeId);
    setNewEventDescription("");
    setNewEventIsAllDay(info.allDay);
    setNewEventIsPrivate(false);
    setNewEventAssignedUserIds(currentUser?._id ? [currentUser._id as string] : []);

    const startD = info.start;
    const startYMD = `${startD.getFullYear()}-${(startD.getMonth() + 1).toString().padStart(2, "0")}-${startD.getDate().toString().padStart(2, "0")}`;
    const startHM = `${startD.getHours().toString().padStart(2, "0")}:${startD.getMinutes().toString().padStart(2, "0")}`;

    setNewEventStartDate(startYMD);
    setNewEventStartTime(startHM);

    const endD = info.end ?? new Date(startD.getTime() + 3600000);
    const endYMD = `${endD.getFullYear()}-${(endD.getMonth() + 1).toString().padStart(2, "0")}-${endD.getDate().toString().padStart(2, "0")}`;
    const endHM = `${endD.getHours().toString().padStart(2, "0")}:${endD.getMinutes().toString().padStart(2, "0")}`;

    setNewEventEndDate(endYMD);
    setNewEventEndTime(endHM);
    setDateModalOpen(true);
  };

  const handleDateClick = (info: DateClickArg) => {
    setSelectedDate(info.date);
    setNewEventMode("event");
    setSelectedOrderIdForMontaz("");
    setOrderSearchQueryForMontaz("");
    setSelectedTeamIdForMontaz("");
    setMontazNote("");
    setNewEventTitle("");
    setNewEventTypeId(defaultEventTypeId);
    setNewEventDescription("");
    setNewEventIsAllDay(false);
    setNewEventIsPrivate(false);
    setNewEventAssignedUserIds(currentUser?._id ? [currentUser._id as string] : []);

    const startD = info.date;
    const startYMD = `${startD.getFullYear()}-${(startD.getMonth() + 1).toString().padStart(2, "0")}-${startD.getDate().toString().padStart(2, "0")}`;
    const startHM = `${startD.getHours().toString().padStart(2, "0")}:${startD.getMinutes().toString().padStart(2, "0")}`;

    setNewEventStartDate(startYMD);
    setNewEventStartTime(startHM);

    const endD = new Date(startD);
    endD.setHours(endD.getHours() + 1);
    const endYMD = `${endD.getFullYear()}-${(endD.getMonth() + 1).toString().padStart(2, "0")}-${endD.getDate().toString().padStart(2, "0")}`;
    const endHM = `${endD.getHours().toString().padStart(2, "0")}:${endD.getMinutes().toString().padStart(2, "0")}`;

    setNewEventEndDate(endYMD);
    setNewEventEndTime(endHM);
    setDateModalOpen(true);
  };

  const handleCreateEvent = async () => {
    if (newEventMode === "montaz") {
      if (!selectedOrderIdForMontaz || !selectedTeamIdForMontaz || !newEventStartDate) return;

      const [startH, startM] = newEventStartTime.split(":").map(Number);
      const startMins = (startH || 8) * 60 + (startM || 0);

      const [endH, endM] = newEventEndTime.split(":").map(Number);
      const endMins = (endH || 16) * 60 + (endM || 0);

      const dateTs = new Date(newEventStartDate).getTime();

      // Pobieramy wybrane zlecenie z listy allOrders
      const targetOrder = allOrders?.find((o) => o._id === selectedOrderIdForMontaz);
      if (!targetOrder) return;

      const targetOrderObj = targetOrder as unknown as {
        projectEndDate?: number;
        installationStartDate?: number;
        installationTeamId?: Id<"installationTeams">;
        installationDates?: Array<{ date: number; startMins?: number; endMins?: number; installationTeamId?: Id<"installationTeams">; note?: string }>;
      };

      let existingDates: Array<{ date: number; startMins?: number; endMins?: number; installationTeamId?: Id<"installationTeams">; note?: string }> = [];

      if (targetOrderObj.installationDates && targetOrderObj.installationDates.length > 0) {
        existingDates = [...targetOrderObj.installationDates];
      } else if (targetOrderObj.projectEndDate || (targetOrderObj.installationStartDate && targetOrderObj.installationStartDate > 10000000)) {
        existingDates = [{
          date: targetOrderObj.projectEndDate ?? (targetOrderObj.installationStartDate! > 10000000 ? targetOrderObj.installationStartDate! : Date.now()),
          startMins: (targetOrderObj.installationStartDate && targetOrderObj.installationStartDate <= 1440) ? targetOrderObj.installationStartDate : 480,
          endMins: 960,
          installationTeamId: targetOrderObj.installationTeamId,
        }];
      }

      const newDateObj = {
        date: dateTs,
        startMins,
        endMins,
        installationTeamId: selectedTeamIdForMontaz ? (selectedTeamIdForMontaz as Id<"installationTeams">) : undefined,
        note: montazNote.trim() || undefined,
      };

      const nextDates = [...existingDates, newDateObj].sort((a, b) => a.date - b.date);
      const first = nextDates[0];

      await updateOrder({
        orderId: selectedOrderIdForMontaz as Id<"orders">,
        installationDates: nextDates,
        projectEndDate: first?.date ?? undefined,
        installationStartDate: first?.startMins ?? undefined,
        installationTeamId: first?.installationTeamId ?? selectedTeamIdForMontaz ? (selectedTeamIdForMontaz as Id<"installationTeams">) : undefined,
      });

      setDateModalOpen(false);
      return;
    }

    if (!newEventTitle.trim() || !effectiveEventTypeId || !newEventStartDate) return;

    const [startH, startM] = newEventStartTime.split(":").map(Number);
    const startDate = new Date(newEventStartDate);
    startDate.setHours(startH || 0, startM || 0, 0, 0);

    const [endH, endM] = newEventEndTime.split(":").map(Number);
    const endDate = new Date(newEventEndDate || newEventStartDate);
    endDate.setHours(endH || 0, endM || 0, 0, 0);

    const finalAssignedIds = newEventAssignedUserIds.length > 0
      ? (newEventAssignedUserIds as Id<"users">[])
      : (currentUser?._id ? [currentUser._id as Id<"users">] : undefined);

    await createCalendarEvent({
      eventTypeId: effectiveEventTypeId as Id<"calendarEventTypes">,
      title: newEventTitle.trim(),
      description: newEventDescription || undefined,
      startDate: startDate.getTime(),
      endDate: newEventIsAllDay ? undefined : endDate.getTime(),
      isAllDay: newEventIsAllDay,
      assignedUserIds: finalAssignedIds,
      isPrivate: newEventIsPrivate,
    });
    setDateModalOpen(false);
  };

  // ─── Event rendering ─────────────────────────────────────────────────────────

  const renderEventContent = (arg: EventContentArg) => {
    const props = arg.event.extendedProps as {
      sourceType: string;
      clientName?: string;
      orderName?: string;
      status?: string;
      customText?: string;
      description?: string;
      serviceName?: string;
      investmentCity?: string;
      assignedUserName?: string;
      assignedUserNames?: string[];
      assignedUserColor?: string;
      color?: string;
      eventTypeName?: string;
      isPrivate?: boolean;
      installationTeamName?: string;
      installationTeamColor?: string;
    };

    const isMonthView = arg.view.type === "dayGridMonth";
    if (isMonthView) {
      const color =
        props.color ??
        props.assignedUserColor ??
        (props.status ? statusColorByKey[props.status] : undefined) ??
        "#3b82f6";

      const typeLabel =
        props.eventTypeName ??
        (props.sourceType === "montaz" ? "Montaż" : "Zdarzenie");

      const titleText =
        props.orderName && props.clientName
          ? `${props.orderName} - ${props.clientName}`
          : props.orderName ?? props.clientName ?? arg.event.title ?? "—";

      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 4,
            background: `${color}18`,
            border: `1px solid ${color}44`,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-strong)",
            cursor: "pointer",
            width: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap",
            boxSizing: "border-box",
            lineHeight: 1.2,
          }}
          onMouseEnter={(e) =>
            setTooltip({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              content: (
                <div style={{ padding: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color }}>{typeLabel}</div>
                  <div style={{ fontWeight: 600, fontSize: 11, marginTop: 2 }}>{titleText}</div>
                  {props.investmentCity && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)" }}>
                      📍 {props.investmentCity}
                    </div>
                  )}
                  {props.installationTeamName && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)" }}>
                      🛠️ {props.installationTeamName}
                    </div>
                  )}
                  {props.assignedUserNames && props.assignedUserNames.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                      👤 {props.assignedUserNames.join(", ")}
                    </div>
                  )}
                </div>
              ),
            })
          }
          onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
          onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: 10,
              color: color,
              flexShrink: 0,
              letterSpacing: "0.04em",
            }}
          >
            {typeLabel}:
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: 11,
              color: "var(--text-strong)",
              flex: 1,
            }}
          >
            {titleText}
          </span>
          {props.assignedUserNames && props.assignedUserNames.length > 0 && (
            <span style={{ fontSize: 9.5, color: "var(--text-mute)", flexShrink: 0 }}>
              ({props.assignedUserNames.join(", ")})
            </span>
          )}
        </div>
      );
    }

    if (props.sourceType === "montaz") {
      const accentColor = props.assignedUserColor ?? statusColorByKey[props.status ?? ""] ?? "#64748b";
      const eventStart = arg.event.start;
      const timeStr = eventStart
        ? `${eventStart.getHours().toString().padStart(2, "0")}:${eventStart.getMinutes().toString().padStart(2, "0")}`
        : null;
      const isQuarterView = arg.view.type === "multiMonth4";

      if (isQuarterView) {
        return (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 1,
              borderRadius: 2, background: accentColor, padding: "0px 2px",
              fontSize: 7, fontWeight: 600, color: "#fff",
              overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer",
              lineHeight: 1.2, maxHeight: "14px",
            }}
            onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content: <><strong>{props.orderName ?? props.clientName}</strong><br />{props.clientName}</> })}
            onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
            onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
          >
            {timeStr && <span style={{ fontWeight: 700 }}>{timeStr}</span>}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{props.orderName ?? props.clientName}</span>
          </div>
        );
      }

      return (
        <div
          className="calendar-event-card"
          style={{
            display: "flex", flexDirection: "row", borderRadius: 8,
            background: "var(--panel)", border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            minWidth: 0, width: "100%", height: "100%", cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            setTooltip({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              content: (
                <div style={{ padding: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: accentColor }}>Montaż</div>
                  <div style={{ fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                    {props.orderName ?? "—"} {props.clientName ? `- ${props.clientName}` : ""}
                  </div>
                  {props.investmentCity && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                      📍 {props.investmentCity}
                    </div>
                  )}
                  {props.assignedUserName && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                      👤 {props.assignedUserName}
                    </div>
                  )}
                </div>
              ),
            })
          }
          onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
          onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
        >
          <div style={{ width: 5, minWidth: 5, background: accentColor, borderRadius: "5px 0 0 5px", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 7px 5px", minWidth: 0, flex: 1, overflow: "hidden" }}>
            {/* Typ zdarzenia */}
            <span style={{ fontSize: 9, fontWeight: 700, color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}33`, borderRadius: 3, padding: "1px 5px", width: "fit-content", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              🔧 Montaż
            </span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
              {timeStr && (
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: accentColor, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
                  {timeStr}
                </span>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-strong)", fontFamily: "monospace" }}>
                {props.orderName ?? "—"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {props.clientName}
            </div>
            {props.investmentCity && (
              <div style={{ fontSize: 11, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                📍 {props.investmentCity}
              </div>
            )}
            {props.assignedUserName && (
              <span style={{ fontSize: 10, fontWeight: 600, color: accentColor, background: `${accentColor}22`, border: `1px solid ${accentColor}44`, borderRadius: 4, padding: "1px 6px" }}>
                {props.assignedUserName}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (props.sourceType === "order-linked") {
      const color = props.color ?? "#3b82f6";
      return (
        <div
          className="calendar-event-card"
          style={{
            display: "flex", flexDirection: "row", borderRadius: 8,
            background: "var(--panel)", border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            minWidth: 0, width: "100%", height: "100%", cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            setTooltip({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              content: (
                <div style={{ padding: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color }}>{props.eventTypeName ?? "Zdarzenie podpięte"}</div>
                  <div style={{ fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                    {props.orderName ?? "—"} {props.clientName ? `- ${props.clientName}` : ""}
                  </div>
                  {props.serviceName && (
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                      🛠️ {props.serviceName}
                    </div>
                  )}
                  {props.installationTeamName && (
                    <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                      👷 {props.installationTeamName}
                    </div>
                  )}
                  {props.customText && (
                    <div style={{ fontSize: 10.5, color: "var(--text-mute)", marginTop: 2, maxWidth: 220 }}>
                      💬 {props.customText}
                    </div>
                  )}
                </div>
              ),
            })
          }
          onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
          onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
        >
          <div style={{ width: 5, minWidth: 5, background: color, borderRadius: "5px 0 0 5px", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 7px 5px", minWidth: 0, flex: 1, overflow: "hidden" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 3, padding: "1px 5px", width: "fit-content", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              🔗 {props.eventTypeName}
            </span>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-strong)", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {props.orderName ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {props.clientName}
            </div>
            {props.installationTeamName && (
              <div style={{ fontSize: 10, fontWeight: 700, color: props.installationTeamColor ?? color, background: `${props.installationTeamColor ?? color}18`, border: `1px solid ${props.installationTeamColor ?? color}33`, borderRadius: 4, padding: "1px 5px", width: "fit-content", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                🛠️ {props.installationTeamName as string}
              </div>
            )}
            {props.customText && (
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-strong)", opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                💬 {props.customText as string}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Custom calendar event
    const color = props.color ?? "#64748b";
    const eventStart = arg.event.start;
    const timeStr = arg.event.allDay ? null : (eventStart
      ? `${eventStart.getHours().toString().padStart(2, "0")}:${eventStart.getMinutes().toString().padStart(2, "0")}`
      : null);

    return (
      <div
        className="calendar-event-card"
        style={{
          display: "flex", flexDirection: "row", borderRadius: 8,
          background: "var(--panel)", border: "1px solid var(--line)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          minWidth: 0, width: "100%", height: "100%", cursor: "pointer",
        }}
        onMouseEnter={(e) =>
          setTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            content: (
              <div style={{ padding: 2 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color }}>{props.eventTypeName}</div>
                <div style={{ fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                  {arg.event.title}
                  {props.isPrivate && " 🔒"}
                </div>
                {props.description && (
                  <div style={{ fontSize: 10.5, color: "var(--text-mute)", marginTop: 4, maxWidth: 220 }}>
                    {props.description}
                  </div>
                )}
                {props.assignedUserNames && props.assignedUserNames.length > 0 && (
                  <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 4 }}>
                    👤 {props.assignedUserNames.join(", ")}
                  </div>
                )}
              </div>
            ),
          })
        }
        onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
        onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
      >
        <div style={{ width: 5, minWidth: 5, background: color, borderRadius: "5px 0 0 5px", alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 7px 5px", minWidth: 0, flex: 1, overflow: "hidden" }}>
          {/* Typ zdarzenia — zawsze na górze */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 3, padding: "1px 5px", letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
              {props.eventTypeName}
            </span>
            {props.isPrivate && <span style={{ fontSize: 9, background: "#f1f5f9", color: "#64748b", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>🔒</span>}
          </div>
          {/* Tytuł + godzina */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {timeStr && (
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: color, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
                {timeStr}
              </span>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {arg.event.title}
            </div>
          </div>
          {/* Godzina zakończenia */}
          {arg.event.end && !arg.event.allDay && (() => {
            const endDate = arg.event.end!;
            const startDate = arg.event.start;
            const sameDay = startDate && endDate.toDateString() === startDate.toDateString();
            const endTimeStr = `${endDate.getHours().toString().padStart(2, "0")}:${endDate.getMinutes().toString().padStart(2, "0")}`;
            const endLabel = sameDay ? `do ${endTimeStr}` : `${endDate.getDate()}.${(endDate.getMonth()+1).toString().padStart(2,"0")} ${endTimeStr}`;
            return (
              <div style={{ fontSize: 10, color: "var(--text-mute)" }}>{endLabel}</div>
            );
          })()}
          {/* Przypisany użytkownik / osoby */}
          {props.assignedUserNames && props.assignedUserNames.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
              {props.assignedUserNames.map((name: string, idx: number) => (
                <span
                  key={idx}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: color,
                    background: `${color}18`,
                    border: `1px solid ${color}33`,
                    borderRadius: 4,
                    padding: "1px 5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    whiteSpace: "nowrap",
                  }}
                >
                  👤 {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate || !events) return [];
    const targetMidnight = localMidnight(selectedDate);
    return events.filter((e) => {
      const startD = (e as { start?: Date }).start;
      if (!startD) return false;
      return localMidnight(startD) === targetMidnight;
    });
  }, [selectedDate, events]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12,
      display: "flex", flexDirection: "column", flex: 1, height: "100%", overflow: "hidden", minHeight: 0,
    }}>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid var(--line)",
        background: "var(--card)", borderRadius: "12px 12px 0 0",
        position: "sticky", top: 0, zIndex: 10, flexShrink: 0, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => calendarRef.current?.getApi().prev()} className="btn btn-xs" style={{ fontSize: 16, padding: "5px 10px", lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-strong)", minWidth: 200, textAlign: "center" }}>
            {weekRange ? fmtWeekRange(weekRange.start, weekRange.end) : `${MONTH_NAMES[month]} ${year}`}
          </span>
          <button onClick={() => calendarRef.current?.getApi().next()} className="btn btn-xs" style={{ fontSize: 16, padding: "5px 10px", lineHeight: 1 }}>›</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>
            {events.length} wydarzeń
          </span>

          {/* Search Box for Order / Client */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              style={{
                position: "absolute",
                left: 10,
                width: 13,
                height: 13,
                color: searchQuery ? "var(--accent)" : "var(--text-mute)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj zlecenia / klienta..."
              style={{
                padding: "5px 26px 5px 28px",
                borderRadius: 20,
                border: searchQuery ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                fontSize: 12,
                background: searchQuery ? "var(--accent)0d" : "var(--panel-2)",
                color: "var(--text-strong)",
                outline: "none",
                width: 210,
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-mute)",
                }}
                title="Wyczyść szukanie"
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", background: "var(--panel-2)", borderRadius: 8, padding: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            {(["dayGridMonth", "timeGridWeek", "timeGridDay"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  try { localStorage.setItem("calendar_default_view", v); } catch {}
                  setTimeout(() => calendarRef.current?.getApi().changeView(v), 0);
                }}
                className={`btn btn-xs calendar-view-btn ${view === v ? "active" : ""}`}
                style={{
                  fontSize: 12, padding: "6px 14px", borderRadius: 5,
                  background: view === v ? "var(--accent)" : "transparent",
                  color: view === v ? "#fff" : "var(--text)",
                  border: "none", fontWeight: view === v ? 600 : 500,
                  transition: "all 0.15s ease", margin: "0 1px",
                }}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <button onClick={() => calendarRef.current?.getApi().today()} className="btn btn-xs" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6 }}>
            Dzisiaj
          </button>

          {!initialTeamId && (
            <>
              <div style={{ width: 1, height: 20, background: "var(--line)", margin: "0 2px" }} />

              {/* Assigned User Filter Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowUserFilterDropdown((prev) => !prev)}
                  className="btn btn-xs"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 12, padding: "6px 12px", borderRadius: 6,
                    background: activeUserFilters.size > 0 ? "var(--accent)22" : "var(--panel-2)",
                    color: activeUserFilters.size > 0 ? "var(--accent)" : "var(--text-strong)",
                    border: `1px solid ${activeUserFilters.size > 0 ? "var(--accent)" : "var(--line)"}`,
                    fontWeight: activeUserFilters.size > 0 ? 700 : 600,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <span>👤</span>
                  <span>
                    {activeUserFilters.size === 0
                      ? "Wszyscy użytkownicy"
                      : activeUserFilters.size === 1
                      ? (allUsers?.find((u) => u._id === Array.from(activeUserFilters)[0])?.displayName ?? "1 użytkownik")
                      : `${activeUserFilters.size} użytkowników`}
                  </span>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>{showUserFilterDropdown ? "▲" : "▼"}</span>
                </button>

                {showUserFilterDropdown && (
                  <div
                    style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0,
                      background: "var(--card)", border: "1px solid var(--line)",
                      borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      zIndex: 50, minWidth: 210, display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                        Przypisany użytkownik
                      </span>
                      {activeUserFilters.size > 0 && (
                        <button
                          onClick={() => setActiveUserFilters(new Set())}
                          style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                        >
                          Pokaż wszystkich
                        </button>
                      )}
                    </div>

                    {allUsers && [...allUsers]
                      .sort((a, b) => (a._id === currentUser?._id ? -1 : b._id === currentUser?._id ? 1 : 0))
                      .map((user) => {
                        const name = user.displayName ?? user.login ?? "?";
                        const isMe = user._id === currentUser?._id;
                        const active = activeUserFilters.has(user._id as string);
                        return (
                          <button
                            key={user._id}
                            onClick={() => toggleUserFilter(user._id as string)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                              padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                              background: active ? `${user.color ?? "#64748b"}18` : "transparent",
                              color: active ? "var(--text-strong)" : "var(--text)",
                              border: `1px solid ${active ? `${user.color ?? "#64748b"}44` : "transparent"}`,
                              cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.1s",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: user.color ?? "#64748b", flexShrink: 0 }} />
                              <span style={{ fontWeight: active ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {isMe ? `${name} (Ja)` : name}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: active ? (user.color ?? "var(--accent)") : "var(--text-mute)" }}>
                              {active ? "✓" : "+"}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Private toggle */}
              <button
                onClick={() => setShowPrivate((p) => !p)}
                className="btn btn-xs"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12, padding: "6px 12px", borderRadius: 6,
                  background: showPrivate ? "var(--accent)22" : "var(--panel-2)",
                  color: showPrivate ? "var(--accent)" : "var(--text-strong)",
                  border: `1px solid ${showPrivate ? "var(--accent)" : "var(--line)"}`,
                  fontWeight: showPrivate ? 700 : 600,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                🔒 Prywatne
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters bar */}
      {!initialTeamId && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "8px 20px", borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
          {/* CTA Clear All Filters Button */}
          <button
            type="button"
            onClick={() => {
              setActiveEventTypeFilters(new Set());
              setActiveSupplierFilters(new Set());
              setActiveTeamFilters(new Set());
              setActiveUserFilters(new Set());
              setActiveCarFilters(new Set());
            }}
            title="Wyczyść wszystkie filtry"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 12px", borderRadius: 20, fontSize: 11.5,
              background: "#fef2f2", color: "#ef4444",
              border: "1.5px solid #fecaca", fontWeight: 700,
              cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(239, 68, 68, 0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fee2e2";
              e.currentTarget.style.borderColor = "#fca5a5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fef2f2";
              e.currentTarget.style.borderColor = "#fecaca";
            }}
          >
            <FilterX style={{ width: 13, height: 13 }} />
            <span>Wyczyść filtry</span>
          </button>

          {/* CTA Select All Filters Button */}
          <button
            type="button"
            onClick={() => {
              if (eventTypes) setActiveEventTypeFilters(new Set(eventTypes.map((t) => t._id)));
              if (activeSuppliers) setActiveSupplierFilters(new Set(activeSuppliers.map((s) => s._id)));
              if (installationTeams) setActiveTeamFilters(new Set(installationTeams.map((t) => t._id)));
              if (cars) setActiveCarFilters(new Set(cars.map((c) => c._id)));
              setActiveUserFilters(new Set());
            }}
            title="Zaznacz wszystkie filtry"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 12px", borderRadius: 20, fontSize: 11.5,
              background: "#ecfdf5", color: "#047857",
              border: "1.5px solid #a7f3d0", fontWeight: 700,
              cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(16, 185, 129, 0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d1fae5";
              e.currentTarget.style.borderColor = "#6ee7b7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ecfdf5";
              e.currentTarget.style.borderColor = "#a7f3d0";
            }}
          >
            <CheckCheck style={{ width: 13, height: 13 }} />
            <span>Zaznacz wszystkie</span>
          </button>

          <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />

          {/* General Event type filters (unlinked) */}
          {eventTypes.filter(t => !t.linkedSupplierId && !t.linkedInstallationTeamId && t.name !== "Administracja").map((type) => {
            const active = activeEventTypeFilters.has(type._id);
            return (
              <button
                key={type._id}
                onClick={() => toggleEventTypeFilter(type._id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                  background: active ? `${type.color}22` : "var(--panel)",
                  color: active ? type.color : "var(--text-mute)",
                  border: `1.5px solid ${active ? type.color : "var(--line)"}`,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: type.color, flexShrink: 0 }} />
                {type.name}
              </button>
            );
          })}

          {/* Dynamic Suppliers Filter (Filtrowanie po Dostawcach) */}
          {activeSuppliers.length > 0 && (
            <>
              <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Dostawcy:
              </span>
              {activeSuppliers.slice(0, 3).map((supplier) => {
                const active = activeSupplierFilters.has(supplier._id);
                const linkedTypes = eventTypes.filter(t => t.linkedSupplierId === supplier._id);
                const hasLinkedTypes = linkedTypes.length > 0;
                
                return (
                  <div key={supplier._id} style={{ position: "relative" }} onMouseEnter={() => setOpenSupplierDropdownId(supplier._id)} onMouseLeave={() => setOpenSupplierDropdownId(null)}>
                    <button
                      onClick={() => toggleSupplierFilter(supplier._id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                        background: active ? "var(--accent)22" : "var(--panel)",
                        color: active ? "var(--accent)" : "var(--text-mute)",
                        border: `1.5px solid ${active ? "var(--accent)" : "var(--line)"}`,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 11 }}>🏢</span>
                      <span>{supplier.name}</span>
                      {hasLinkedTypes && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{openSupplierDropdownId === supplier._id ? "▲" : "▼"}</span>}
                    </button>

                    {hasLinkedTypes && openSupplierDropdownId === supplier._id && (
                      <div
                        style={{
                          position: "absolute", top: "calc(100% + 6px)", left: 0,
                          background: "var(--card)", border: "1px solid var(--line)",
                          borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                          zIndex: 50, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                            Typy wydarzeń dla {supplier.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const allActive = linkedTypes.every(t => activeEventTypeFilters.has(t._id));
                              setActiveEventTypeFilters(prev => {
                                const next = new Set(prev);
                                linkedTypes.forEach(t => {
                                  if (allActive) next.delete(t._id);
                                  else next.add(t._id);
                                });
                                return next;
                              });
                            }}
                            style={{ fontSize: 10, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
                          >
                            {linkedTypes.every(t => activeEventTypeFilters.has(t._id)) ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                          </button>
                        </div>
                        {linkedTypes.map((type) => {
                          const typeActive = activeEventTypeFilters.has(type._id);
                          return (
                            <button
                              key={type._id}
                              onClick={(e) => { e.stopPropagation(); toggleEventTypeFilter(type._id); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                                background: typeActive ? `${type.color}18` : "transparent",
                                color: typeActive ? "var(--text-strong)" : "var(--text)",
                                border: `1px solid ${typeActive ? `${type.color}44` : "transparent"}`,
                                cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: type.color, flexShrink: 0 }} />
                                <span style={{ fontWeight: typeActive ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{type.name}</span>
                              </div>
                              <span style={{ fontSize: 12, color: typeActive ? type.color : "var(--text-mute)" }}>
                                {typeActive ? "✓" : "+"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {activeSuppliers.length > 3 && (
                <div style={{ position: "relative" }} onMouseEnter={() => setOpenSupplierDropdownId("more")} onMouseLeave={() => setOpenSupplierDropdownId(null)}>
                  <button
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                      background: "var(--panel)",
                      color: "var(--text-mute)",
                      border: "1.5px solid var(--line)",
                      fontWeight: 500,
                      cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                    }}
                  >
                    <span>Więcej ({activeSuppliers.length - 3})</span>
                    <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{openSupplierDropdownId?.startsWith("more") || openSupplierDropdownId?.startsWith("supplier_") ? "▲" : "▼"}</span>
                  </button>

                  {(openSupplierDropdownId === "more" || openSupplierDropdownId?.startsWith("supplier_")) && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0,
                        background: "var(--card)", border: "1px solid var(--line)",
                        borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        zIndex: 50, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                          Pozostali dostawcy
                        </span>
                      </div>
                      {activeSuppliers.slice(3).map((supplier) => {
                        const active = activeSupplierFilters.has(supplier._id);
                        const linkedTypes = eventTypes.filter((t) => t.linkedSupplierId === supplier._id);
                        const hasLinkedTypes = linkedTypes.length > 0;
                        const subOpen = openSupplierDropdownId === `supplier_${supplier._id}`;

                        return (
                          <div
                            key={supplier._id}
                            style={{ position: "relative" }}
                            onMouseEnter={() => setOpenSupplierDropdownId(`supplier_${supplier._id}`)}
                            onMouseLeave={() => setOpenSupplierDropdownId("more")}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSupplierFilter(supplier._id); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                                background: active ? "var(--accent)22" : "transparent",
                                color: active ? "var(--accent)" : "var(--text)",
                                border: `1px solid ${active ? "var(--accent)44" : "transparent"}`,
                                cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                <span style={{ fontWeight: active ? 700 : 500 }}>{supplier.name}</span>
                                {hasLinkedTypes && (
                                  <span style={{ fontSize: 9, opacity: 0.7 }}>{subOpen ? "◀" : "▶"}</span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: active ? "var(--accent)" : "var(--text-mute)" }}>
                                {active ? "✓" : "+"}
                              </span>
                            </button>

                            {hasLinkedTypes && subOpen && (
                              <div
                                style={{
                                  position: "absolute", top: 0, left: "100%", marginLeft: 6,
                                  background: "var(--card)", border: "1px solid var(--line)",
                                  borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                  zIndex: 60, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                                    Typy wydarzeń
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const allActive = linkedTypes.every((t) => activeEventTypeFilters.has(t._id));
                                      setActiveEventTypeFilters((prev) => {
                                        const next = new Set(prev);
                                        linkedTypes.forEach((t) => {
                                          if (allActive) next.delete(t._id);
                                          else next.add(t._id);
                                        });
                                        return next;
                                      });
                                    }}
                                    style={{ fontSize: 10, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
                                  >
                                    {linkedTypes.every((t) => activeEventTypeFilters.has(t._id)) ? "Odznacz" : "Zaznacz"}
                                  </button>
                                </div>
                                {linkedTypes.map((type) => {
                                  const typeActive = activeEventTypeFilters.has(type._id);
                                  return (
                                    <button
                                      key={type._id}
                                      onClick={(e) => { e.stopPropagation(); toggleEventTypeFilter(type._id); }}
                                      style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                        padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                                        background: typeActive ? `${type.color}18` : "transparent",
                                        color: typeActive ? "var(--text-strong)" : "var(--text)",
                                        border: `1px solid ${typeActive ? `${type.color}44` : "transparent"}`,
                                        cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: type.color, flexShrink: 0 }} />
                                        <span style={{ fontWeight: typeActive ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{type.name}</span>
                                      </div>
                                      <span style={{ fontSize: 12, color: typeActive ? type.color : "var(--text-mute)" }}>
                                        {typeActive ? "✓" : "+"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Ekipy Filter */}
          {installationTeams.length > 0 && (
            <>
              <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Ekipy:
              </span>
              {installationTeams.slice(0, 3).map((team) => {
                const active = activeTeamFilters.has(team._id as string);
                const linkedTypes = eventTypes.filter(t => t.linkedInstallationTeamId === team._id);
                const hasLinkedTypes = linkedTypes.length > 0;

                return (
                  <div key={team._id} style={{ position: "relative" }} onMouseEnter={() => setOpenTeamDropdownId(team._id)} onMouseLeave={() => setOpenTeamDropdownId(null)}>
                    <button
                      onClick={() => toggleTeamFilter(team._id as string)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                        background: active ? `${team.color}22` : "var(--panel)",
                        color: active ? team.color : "var(--text-mute)",
                        border: `1.5px solid ${active ? team.color : "var(--line)"}`,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 11 }}>👷</span>
                      <span>{team.name}</span>
                      {hasLinkedTypes && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{openTeamDropdownId === team._id ? "▲" : "▼"}</span>}
                    </button>

                    {hasLinkedTypes && openTeamDropdownId === team._id && (
                      <div
                        style={{
                          position: "absolute", top: "calc(100% + 6px)", left: 0,
                          background: "var(--card)", border: "1px solid var(--line)",
                          borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                          zIndex: 50, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                            Typy wydarzeń dla {team.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const allActive = linkedTypes.every(t => activeEventTypeFilters.has(t._id));
                              setActiveEventTypeFilters(prev => {
                                const next = new Set(prev);
                                linkedTypes.forEach(t => {
                                  if (allActive) next.delete(t._id);
                                  else next.add(t._id);
                                });
                                return next;
                              });
                            }}
                            style={{ fontSize: 10, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
                          >
                            {linkedTypes.every(t => activeEventTypeFilters.has(t._id)) ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                          </button>
                        </div>
                        {linkedTypes.map((type) => {
                          const typeActive = activeEventTypeFilters.has(type._id);
                          return (
                            <button
                              key={type._id}
                              onClick={(e) => { e.stopPropagation(); toggleEventTypeFilter(type._id); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                                background: typeActive ? `${type.color}18` : "transparent",
                                color: typeActive ? "var(--text-strong)" : "var(--text)",
                                border: `1px solid ${typeActive ? `${type.color}44` : "transparent"}`,
                                cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: type.color, flexShrink: 0 }} />
                                <span style={{ fontWeight: typeActive ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{type.name}</span>
                              </div>
                              <span style={{ fontSize: 12, color: typeActive ? type.color : "var(--text-mute)" }}>
                                {typeActive ? "✓" : "+"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {installationTeams.length > 3 && (
                <div style={{ position: "relative" }} onMouseEnter={() => setOpenTeamDropdownId("more")} onMouseLeave={() => setOpenTeamDropdownId(null)}>
                  <button
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                      background: "var(--panel)",
                      color: "var(--text-mute)",
                      border: "1.5px solid var(--line)",
                      fontWeight: 500,
                      cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                    }}
                  >
                    <span>Więcej ({installationTeams.length - 3})</span>
                    <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{openTeamDropdownId?.startsWith("more") || openTeamDropdownId?.startsWith("team_") ? "▲" : "▼"}</span>
                  </button>

                  {(openTeamDropdownId === "more" || openTeamDropdownId?.startsWith("team_")) && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0,
                        background: "var(--card)", border: "1px solid var(--line)",
                        borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        zIndex: 50, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                          Pozostałe ekipy
                        </span>
                      </div>
                      {installationTeams.slice(3).map((team) => {
                        const active = activeTeamFilters.has(team._id as string);
                        const linkedTypes = eventTypes.filter((t) => t.linkedInstallationTeamId === team._id);
                        const hasLinkedTypes = linkedTypes.length > 0;
                        const subOpen = openTeamDropdownId === `team_${team._id}`;

                        return (
                          <div
                            key={team._id}
                            style={{ position: "relative" }}
                            onMouseEnter={() => setOpenTeamDropdownId(`team_${team._id}`)}
                            onMouseLeave={() => setOpenTeamDropdownId("more")}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTeamFilter(team._id as string); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                                background: active ? `${team.color}22` : "transparent",
                                color: active ? team.color : "var(--text)",
                                border: `1px solid ${active ? `${team.color}44` : "transparent"}`,
                                cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                <span style={{ fontWeight: active ? 700 : 500 }}>{team.name}</span>
                                {hasLinkedTypes && (
                                  <span style={{ fontSize: 9, opacity: 0.7 }}>{subOpen ? "◀" : "▶"}</span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: active ? team.color : "var(--text-mute)" }}>
                                {active ? "✓" : "+"}
                              </span>
                            </button>

                            {hasLinkedTypes && subOpen && (
                              <div
                                style={{
                                  position: "absolute", top: 0, left: "100%", marginLeft: 6,
                                  background: "var(--card)", border: "1px solid var(--line)",
                                  borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                  zIndex: 60, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                                    Typy wydarzeń
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const allActive = linkedTypes.every((t) => activeEventTypeFilters.has(t._id));
                                      setActiveEventTypeFilters((prev) => {
                                        const next = new Set(prev);
                                        linkedTypes.forEach((t) => {
                                          if (allActive) next.delete(t._id);
                                          else next.add(t._id);
                                        });
                                        return next;
                                      });
                                    }}
                                    style={{ fontSize: 10, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
                                  >
                                    {linkedTypes.every((t) => activeEventTypeFilters.has(t._id)) ? "Odznacz" : "Zaznacz"}
                                  </button>
                                </div>
                                {linkedTypes.map((type) => {
                                  const typeActive = activeEventTypeFilters.has(type._id);
                                  return (
                                    <button
                                      key={type._id}
                                      onClick={(e) => { e.stopPropagation(); toggleEventTypeFilter(type._id); }}
                                      style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                                        padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                                        background: typeActive ? `${type.color}18` : "transparent",
                                        color: typeActive ? "var(--text-strong)" : "var(--text)",
                                        border: `1px solid ${typeActive ? `${type.color}44` : "transparent"}`,
                                        cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: type.color, flexShrink: 0 }} />
                                        <span style={{ fontWeight: typeActive ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{type.name}</span>
                                      </div>
                                      <span style={{ fontSize: 12, color: typeActive ? type.color : "var(--text-mute)" }}>
                                        {typeActive ? "✓" : "+"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Dynamic Cars Fleet Filter (Filtrowanie po Flocie aut) */}
          {cars && cars.length > 0 && (
            <>
              <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Flota:
              </span>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowCarFilterDropdown((prev) => !prev)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                    background: activeCarFilters.size > 0 ? "var(--accent)22" : "var(--panel)",
                    color: activeCarFilters.size > 0 ? "var(--accent)" : "var(--text-mute)",
                    border: `1.5px solid ${activeCarFilters.size > 0 ? "var(--accent)" : "var(--line)"}`,
                    fontWeight: activeCarFilters.size > 0 ? 700 : 500,
                    cursor: "pointer", transition: "all 0.12s", fontFamily: "inherit",
                  }}
                >
                  <Car style={{ width: 13, height: 13 }} />
                  <span>
                    {activeCarFilters.size === 0
                      ? "Brak wybranych aut"
                      : activeCarFilters.size === cars.length
                      ? "Wszystkie auta"
                      : `${activeCarFilters.size} z ${cars.length} aut`}
                  </span>
                  <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>{showCarFilterDropdown ? "▲" : "▼"}</span>
                </button>

                {showCarFilterDropdown && (
                  <div
                    style={{
                      position: "absolute", top: "calc(100% + 6px)", left: 0,
                      background: "var(--card)", border: "1px solid var(--line)",
                      borderRadius: 10, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      zIndex: 50, minWidth: 240, display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>
                        Samochody we flocie
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeCarFilters.size === cars.length) {
                            setActiveCarFilters(new Set());
                          } else {
                            setActiveCarFilters(new Set(cars.map((c) => c._id)));
                          }
                        }}
                        style={{ fontSize: 10, color: "var(--accent)", cursor: "pointer", background: "none", border: "none", fontWeight: 600 }}
                      >
                        {activeCarFilters.size === cars.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                      </button>
                    </div>

                    {cars.map((car) => {
                      const active = activeCarFilters.has(car._id);
                      return (
                        <button
                          key={car._id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCarFilters((prev) => {
                              const next = new Set(prev);
                              if (next.has(car._id)) next.delete(car._id);
                              else next.add(car._id);
                              return next;
                            });
                          }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                            padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                            background: active ? "var(--accent)18" : "transparent",
                            color: active ? "var(--text-strong)" : "var(--text)",
                            border: `1px solid ${active ? "var(--accent)44" : "transparent"}`,
                            cursor: "pointer", textAlign: "left", transition: "all 0.1s", width: "100%",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                            <Car style={{ width: 13, height: 13, color: active ? "var(--accent)" : "var(--text-mute)", flexShrink: 0 }} />
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span style={{ fontWeight: active ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {car.registrationNumber} ({car.make} {car.model})
                              </span>
                              {car.teamName && (
                                <span style={{ fontSize: 10, color: "var(--text-mute)" }}>🛠️ {car.teamName}</span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: active ? "var(--accent)" : "var(--text-mute)" }}>
                            {active ? "✓" : "+"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Calendar */}
      <div style={{ flex: 1, height: "100%", minHeight: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <style>{`
          .fc {
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .fc-view-harness {
            flex: 1 !important;
            height: 100% !important;
          }
          .fc-view-harness-active > .fc-view {
            height: 100% !important;
          }
          .fc-daygrid .fc-scroller {
            overflow: hidden !important;
          }
          .fc-daygrid-body, .fc-scrollgrid-sync-table {
            height: 100% !important;
          }
          .fc-timegrid-event-harness {
            pointer-events: auto !important;
          }
          .fc-timegrid-event .fc-event-main {
            height: 100% !important;
          }
          .fc-timegrid-event .fc-event-resizer {
            z-index: 9999 !important;
            left: 0 !important;
            right: 0 !important;
            height: 14px !important;
            cursor: ns-resize !important;
            pointer-events: auto !important;
            display: block !important;
          }
          .fc-timegrid-event .fc-event-resizer-bottom {
            bottom: 0 !important;
          }
          .fc-timegrid-event .fc-event-resizer-top {
            top: 0 !important;
          }
          .fc-timegrid-event:hover .fc-event-resizer-bottom::after {
            content: '';
            position: absolute;
            bottom: 3px;
            left: 50%;
            transform: translateX(-50%);
            width: 32px;
            height: 4px;
            border-radius: 2px;
            background: rgba(0, 0, 0, 0.4);
            box-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
          }
          .fc-timegrid-event:hover .fc-event-resizer-top::after {
            content: '';
            position: absolute;
            top: 3px;
            left: 50%;
            transform: translateX(-50%);
            width: 32px;
            height: 4px;
            border-radius: 2px;
            background: rgba(0, 0, 0, 0.4);
            box-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
          }
        `}</style>
        <FullCalendar
          ref={calendarRef}
          key={view}
          plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
          initialView={view}
          locale={plLocale}
          headerToolbar={false}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          select={handleSelect}
          eventDurationEditable={true}
          eventResizableFromStart={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize as unknown as (arg: unknown) => void}
          dateClick={handleDateClick}
          moreLinkClick={(arg) => {
            setSelectedDate(arg.date);
            setDayEventsListModalOpen(true);
            return "none";
          }}
          datesSet={handleDatesSet}
          eventContent={renderEventContent}
          height="100%"
          expandRows={true}
          dayMaxEvents={false}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false, meridiem: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false, meridiem: false }}
          slotDuration="01:00:00"
          slotMinTime="06:00:00"
          slotMaxTime="17:00:00"
          allDaySlot={true}
          allDayText="Cały dzień"
          nowIndicator={true}
          eventDisplay="block"
          eventClassNames={["fc-event-custom"]}
        />
        {(calendarEvents === undefined || linkedOrderEvents === undefined) && (
          <div style={{
            position: "absolute", bottom: 12, right: 16, fontSize: 11, color: "var(--text-mute)",
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6,
            padding: "4px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", pointerEvents: "none",
          }}>
            Ładowanie…
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip.visible && createPortal(
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y + 12, zIndex: 100,
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8,
          padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          fontSize: 12, color: "var(--text)", maxWidth: 260, pointerEvents: "none",
        }}>
          {tooltip.content}
        </div>,
        document.body
      )}

      {/* Day Events List Drawer (Slide-over from right) */}
      {dayEventsListModalOpen && selectedDate && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <style>{`
            @keyframes slideInFromRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setDayEventsListModalOpen(false)} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 480, height: "100vh",
            background: "var(--panel)", borderLeft: "1px solid var(--line)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden",
            zIndex: 51, animation: "slideInFromRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>Wydarzenia w dniu</div>
                <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>{fmtDateTime(selectedDate)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* View Mode Toggle */}
                <div style={{ display: "flex", background: "var(--panel-2)", borderRadius: 8, padding: 2, border: "1px solid var(--line)" }}>
                  <button
                    onClick={() => setDayEventsViewMode("timeline")}
                    style={{
                      fontSize: 11, fontWeight: dayEventsViewMode === "timeline" ? 700 : 500,
                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: dayEventsViewMode === "timeline" ? "var(--accent)" : "transparent",
                      color: dayEventsViewMode === "timeline" ? "#fff" : "var(--text-mute)",
                      transition: "all 0.15s", fontFamily: "inherit",
                    }}
                  >
                    ⏱ Siatka
                  </button>
                  <button
                    onClick={() => setDayEventsViewMode("list")}
                    style={{
                      fontSize: 11, fontWeight: dayEventsViewMode === "list" ? 700 : 500,
                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: dayEventsViewMode === "list" ? "var(--accent)" : "transparent",
                      color: dayEventsViewMode === "list" ? "#fff" : "var(--text-mute)",
                      transition: "all 0.15s", fontFamily: "inherit",
                    }}
                  >
                    📋 Lista
                  </button>
                </div>
                <button onClick={() => setDayEventsListModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* List or Timeline Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {selectedDayEvents.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>
                  Brak wydarzeń w tym dniu
                </div>
              ) : dayEventsViewMode === "list" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedDayEvents.map((ev, idx) => {
                    const props = (ev as { extendedProps: Record<string, unknown> }).extendedProps;
                    const color = (props.color as string) || (props.assignedUserColor as string) || "#3b82f6";
                    const title = (ev as { title: string }).title;
                    const startD = (ev as { start?: Date }).start;
                    const timeStr = (ev as { allDay?: boolean }).allDay || !startD
                      ? "Cały dzień"
                      : `${startD.getHours().toString().padStart(2,"0")}:${startD.getMinutes().toString().padStart(2,"0")}`;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleEventClick({ event: { id: (ev as { id: string }).id, title, start: startD, end: (ev as { end?: Date }).end, extendedProps: props } } as unknown as EventClickArg)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                          borderRadius: 10, background: "var(--panel-2)", border: "1px solid var(--line)",
                          borderLeft: `4px solid ${color}`,
                          cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", wordBreak: "break-word" }}>
                              {title}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-mute)", flexShrink: 0 }}>{timeStr}</span>
                          </div>
                          {Boolean(props.clientName) && (
                            <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>
                              {String(props.clientName)}
                            </div>
                          )}
                          {Boolean(props.description) && (
                            <div style={{ fontSize: 11, color: "var(--text)", marginTop: 4, lineHeight: 1.4 }}>
                              {String(props.description)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Timeline Hourly Schedule Agenda (06:00 - 22:00) */
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* All-day events banner */}
                  {(() => {
                    const allDayEvs = selectedDayEvents.filter(
                      (ev) => (ev as { allDay?: boolean }).allDay || !(ev as { start?: Date }).start,
                    );
                    if (allDayEvs.length === 0) return null;
                    return (
                      <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-mute)", letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>
                          Cały dzień ({allDayEvs.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {allDayEvs.map((ev, idx) => {
                            const props = (ev as { extendedProps: Record<string, unknown> }).extendedProps;
                            const color = (props.color as string) || "#3b82f6";
                            const title = (ev as { title: string }).title;
                            return (
                              <div
                                key={idx}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(
                                    "text/plain",
                                    JSON.stringify({ id: (ev as { id: string }).id, extendedProps: props })
                                  );
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px",
                                  background: "var(--panel)", borderRadius: 6, border: `1px solid ${color}44`,
                                  borderLeft: `4px solid ${color}`, cursor: "grab",
                                }}
                              >
                                <div
                                  onClick={() => handleEventClick({ event: { id: (ev as { id: string }).id, title, extendedProps: props } } as unknown as EventClickArg)}
                                  style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}
                                >
                                  <span style={{ fontSize: 11, color: "var(--text-mute)", userSelect: "none" }}>⋮⋮</span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {title}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="Ustaw godzinę na siatce">
                                  <span style={{ fontSize: 10, color: "var(--text-mute)" }}>🕒</span>
                                  <input
                                    type="time"
                                    defaultValue="08:00"
                                    onChange={(e) => handleUpdateEventTime({ id: (ev as { id: string }).id, extendedProps: props }, e.target.value)}
                                    style={{
                                      fontSize: 11, padding: "1px 4px", borderRadius: 4,
                                      border: "1px solid var(--line)", background: "var(--panel-2)",
                                      color: "var(--text-strong)", fontFamily: "inherit", cursor: "pointer",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Hourly Agenda Slots (06:00 - 22:00) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid var(--line)" }}>
                    {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => {
                      const hourStr = `${h.toString().padStart(2, "0")}:00`;
                      const eventsInHour = selectedDayEvents.filter((ev) => {
                        if ((ev as { allDay?: boolean }).allDay || !(ev as { start?: Date }).start) return false;
                        const startD = (ev as { start: Date }).start;
                        return startD.getHours() === h;
                      });
                      const isTarget = dragOverHour === h;

                      return (
                        <div
                          key={h}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverHour !== h) setDragOverHour(h);
                          }}
                          onDragLeave={() => setDragOverHour(null)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setDragOverHour(null);
                            const raw = e.dataTransfer.getData("text/plain");
                            if (!raw) return;
                            try {
                              const data = JSON.parse(raw);
                              const newTimeStr = `${h.toString().padStart(2, "0")}:00`;
                              await handleUpdateEventTime(data, newTimeStr);
                            } catch (err) {
                              console.error("Drop error", err);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            minHeight: 48,
                            padding: "8px 8px",
                            margin: "0 -8px",
                            borderRadius: 8,
                            borderBottom: isTarget ? "2px dashed var(--accent)" : "1px solid var(--line)",
                            background: isTarget ? "var(--accent)18" : "transparent",
                            transition: "all 0.12s",
                            boxSizing: "border-box",
                          }}
                        >
                          {/* Hour Label */}
                          <div style={{ width: 48, fontSize: 11, fontWeight: 700, color: isTarget ? "var(--accent)" : "var(--text-mute)", flexShrink: 0, paddingTop: 4 }}>
                            {hourStr}
                          </div>

                          {/* Events or Empty Slot */}
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                            {eventsInHour.length === 0 ? (
                              <div style={{ fontSize: 11, color: isTarget ? "var(--accent)" : "var(--line)", fontStyle: "italic", paddingTop: 4 }}>
                                {isTarget ? "Upuść tutaj..." : "—"}
                              </div>
                            ) : (
                              eventsInHour.map((ev, idx) => {
                                const props = (ev as { extendedProps: Record<string, unknown> }).extendedProps;
                                const color = (props.color as string) || (props.assignedUserColor as string) || "#3b82f6";
                                const title = (ev as { title: string }).title;
                                const startD = (ev as { start: Date }).start;
                                const startTimeVal = `${startD.getHours().toString().padStart(2, "0")}:${startD.getMinutes().toString().padStart(2, "0")}`;

                                return (
                                  <div
                                    key={idx}
                                    draggable={true}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData(
                                        "text/plain",
                                        JSON.stringify({ id: (ev as { id: string }).id, extendedProps: props })
                                      );
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 8,
                                      padding: "8px 12px",
                                      background: "var(--panel-2)",
                                      border: `1px solid ${color}44`,
                                      borderLeft: `4px solid ${color}`,
                                      borderRadius: 8,
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                      cursor: "grab",
                                    }}
                                  >
                                    <div
                                      onClick={() => handleEventClick({ event: { id: (ev as { id: string }).id, title, start: startD, extendedProps: props } } as unknown as EventClickArg)}
                                      style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}
                                    >
                                      <span style={{ fontSize: 11, color: "var(--text-mute)", userSelect: "none" }}>⋮⋮</span>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {title}
                                        </div>
                                         {Boolean(props.clientName) && (
                                          <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {props.clientName as string}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Inline Time Setter */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="time"
                                        value={startTimeVal}
                                        onChange={(e) => handleUpdateEventTime({ id: (ev as { id: string }).id, extendedProps: props }, e.target.value)}
                                        style={{
                                          fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                                          border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)",
                                          fontFamily: "inherit", cursor: "pointer",
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <button
                onClick={() => setDayEventsListModalOpen(false)}
                className="btn btn-xs"
                style={{ fontSize: 13, padding: "7px 16px" }}
              >
                Zamknij
              </button>
              <button
                onClick={() => {
                  setDayEventsListModalOpen(false);
                  handleDateClick({ date: selectedDate } as DateClickArg);
                }}
                className="btn primary btn-xs"
                style={{ fontSize: 13, padding: "7px 16px" }}
              >
                + Dodaj nowe wydarzenie
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Date click modal (Slide-over drawer from right for adding events) */}
      {dateModalOpen && selectedDate && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <style>{`
            @keyframes slideInFromRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setDateModalOpen(false)} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 480, height: "100vh",
            background: "var(--panel)", borderLeft: "1px solid var(--line)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden",
            zIndex: 51, animation: "slideInFromRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>
                  {newEventMode === "montaz" ? "Dodaj termin montażu" : "Nowe wydarzenie"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>{fmtDateTime(selectedDate)}</div>
              </div>
              <button onClick={() => setDateModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Mode Selector Tabs */}
                <div style={{ display: "flex", borderRadius: 8, background: "var(--panel-2)", padding: 3, border: "1px solid var(--line)" }}>
                  <button
                    type="button"
                    onClick={() => setNewEventMode("event")}
                    style={{
                      flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: newEventMode === "event" ? "var(--card)" : "transparent",
                      color: newEventMode === "event" ? "var(--text-strong)" : "var(--text-mute)",
                      border: "none", cursor: "pointer", transition: "all 0.1s",
                      boxShadow: newEventMode === "event" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    Standardowe wydarzenie
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEventMode("montaz")}
                    style={{
                      flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: newEventMode === "montaz" ? "var(--accent)" : "transparent",
                      color: newEventMode === "montaz" ? "#ffffff" : "var(--text-mute)",
                      border: "none", cursor: "pointer", transition: "all 0.1s",
                      boxShadow: newEventMode === "montaz" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    🛠️ Termin montażu
                  </button>
                </div>

                {newEventMode === "montaz" ? (
                  <>
                    {/* Wybór zlecenia z wyszukiwarką */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                        Szukaj i wybierz zlecenie *
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={
                            selectedOrderIdForMontaz
                              ? (() => {
                                  const sel = (allOrders ?? []).find((o) => o._id === selectedOrderIdForMontaz);
                                  if (!sel) return orderSearchQueryForMontaz;
                                  const custom = sel.customText ? ` [${sel.customText}]` : "";
                                  return `${sel.name ?? "Zlecenie"} - ${sel.clientName}${custom}`;
                                })()
                              : orderSearchQueryForMontaz
                          }
                          onChange={(e) => {
                            setSelectedOrderIdForMontaz("");
                            setOrderSearchQueryForMontaz(e.target.value);
                          }}
                          placeholder="Szukaj po numerze zlecenia, klienta lub tekście własnym…"
                          style={{
                            width: "100%", fontSize: 13, padding: "8px 30px 8px 12px", borderRadius: 6,
                            border: "1px solid var(--line)", background: "var(--panel-2)",
                            color: "var(--text-strong)", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                          }}
                        />
                        {selectedOrderIdForMontaz && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderIdForMontaz("");
                              setOrderSearchQueryForMontaz("");
                            }}
                            style={{
                              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                              border: "none", background: "none", color: "var(--text-mute)", cursor: "pointer", fontSize: 14,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Lista podpowiedzi wyszukiwania */}
                      {!selectedOrderIdForMontaz && (
                        <div
                          style={{
                            marginTop: 4, maxHeight: 180, overflowY: "auto",
                            borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: 2, padding: 4,
                          }}
                        >
                          {(allOrders ?? [])
                            .filter((o) => {
                              const q = orderSearchQueryForMontaz.trim().toLowerCase();
                              if (!q) return true;
                              const nameStr = (o.name ?? "").toLowerCase();
                              const clientStr = (o.clientName ?? "").toLowerCase();
                              const customStr = (o.customText ?? "").toLowerCase();
                              return nameStr.includes(q) || clientStr.includes(q) || customStr.includes(q);
                            })
                            .slice(0, 50)
                            .map((o) => (
                              <button
                                key={o._id}
                                type="button"
                                onClick={() => {
                                  setSelectedOrderIdForMontaz(o._id);
                                  setOrderSearchQueryForMontaz("");
                                }}
                                style={{
                                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                                  padding: "6px 10px", borderRadius: 6, border: "none", background: "transparent",
                                  cursor: "pointer", textAlign: "left", transition: "background 0.1s", width: "100%",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
                                    {o.name ?? "Zlecenie"}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--text-mute)", fontWeight: 500 }}>
                                    {o.clientName}
                                  </span>
                                </div>
                                {o.customText && (
                                  <span style={{ fontSize: 11, color: "var(--accent)", fontStyle: "italic" }}>
                                    {o.customText}
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Data montażu & Godziny */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                        Data i godziny montażu *
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="date"
                          value={newEventStartDate}
                          onChange={(e) => setNewEventStartDate(e.target.value)}
                          style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                        />
                        <input
                          type="time"
                          value={newEventStartTime}
                          onChange={(e) => setNewEventStartTime(e.target.value)}
                          title="Godzina rozpoczęcia"
                          style={{ width: 100, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                        />
                        <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: "var(--text-mute)" }}>do</span>
                        <input
                          type="time"
                          value={newEventEndTime}
                          onChange={(e) => setNewEventEndTime(e.target.value)}
                          title="Godzina zakończenia"
                          style={{ width: 100, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                        />
                      </div>
                    </div>

                    {/* Ekipa montażowa */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                        Ekipa montażowa *
                      </label>
                      <select
                        value={selectedTeamIdForMontaz}
                        onChange={(e) => setSelectedTeamIdForMontaz(e.target.value)}
                        style={{
                          width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 6,
                          border: "1px solid var(--line)", background: "var(--panel-2)",
                          color: "var(--text-strong)", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                        }}
                      >
                        <option value="">— Wybierz ekipę montażową —</option>
                        {installationTeams.map((team) => (
                          <option key={team._id} value={team._id}>
                            🛠️ {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Notatka */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>
                        Notatka do terminu (opcjonalnie)
                      </label>
                      <input
                        type="text"
                        value={montazNote}
                        onChange={(e) => setMontazNote(e.target.value)}
                        placeholder="np. montaż parapetów / dokończenie obróbki..."
                        style={{
                          width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 6,
                          border: "1px solid var(--line)", background: "var(--panel-2)",
                          color: "var(--text-strong)", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Title */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>Tytuł *</label>
                      <input
                        type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)}
                        placeholder="Nazwa zdarzenia…" autoFocus
                        style={{ width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>

                {/* All day toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" id="allDay" checked={newEventIsAllDay} onChange={(e) => setNewEventIsAllDay(e.target.checked)} />
                  <label htmlFor="allDay" style={{ fontSize: 13, color: "var(--text)", cursor: "pointer" }}>Cały dzień</label>
                </div>

                {/* Początek zdarzenia */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>Początek zdarzenia *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="date" value={newEventStartDate} onChange={(e) => {
                        setNewEventStartDate(e.target.value);
                        if (!newEventEndDate || e.target.value > newEventEndDate) {
                          setNewEventEndDate(e.target.value);
                        }
                      }}
                      style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                    />
                    {!newEventIsAllDay && (
                      <input
                        type="time" value={newEventStartTime} onChange={(e) => setNewEventStartTime(e.target.value)}
                        style={{ width: 110, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                      />
                    )}
                  </div>
                </div>

                {/* Koniec zdarzenia */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>Koniec zdarzenia *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="date" value={newEventEndDate} onChange={(e) => setNewEventEndDate(e.target.value)}
                      style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                    />
                    {!newEventIsAllDay && (
                      <input
                        type="time" value={newEventEndTime} onChange={(e) => setNewEventEndTime(e.target.value)}
                        style={{ width: 110, fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit" }}
                      />
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>Opis (opcjonalnie)</label>
                  <textarea
                    value={newEventDescription} onChange={(e) => setNewEventDescription(e.target.value)}
                    rows={2} style={{ width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--text-strong)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>

                {/* Assign users */}
                {allUsers && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", display: "block", marginBottom: 5 }}>Przypisane osoby</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {allUsers.map((user) => {
                        const selected = newEventAssignedUserIds.includes(user._id as string);
                        const name = user.displayName ?? user.login ?? "?";
                        const isMe = currentUser?._id === user._id;
                        return (
                          <button
                            key={user._id}
                            onClick={() => setNewEventAssignedUserIds((prev) => selected ? prev.filter((id) => id !== user._id) : [...prev, user._id as string])}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                              background: selected ? `${user.color ?? "#64748b"}22` : "var(--panel)",
                              color: selected ? (user.color ?? "var(--accent)") : "var(--text-mute)",
                              border: `1.5px solid ${selected ? (user.color ?? "var(--accent)") : "var(--line)"}`,
                              fontWeight: selected ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: user.color ?? "#94a3b8" }} />
                            {name} {isMe && "(Ty)"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setDateModalOpen(false)} className="btn btn-xs" style={{ fontSize: 13, padding: "7px 16px" }}>Anuluj</button>
              <button
                onClick={handleCreateEvent}
                disabled={newEventMode === "montaz" ? (!selectedOrderIdForMontaz || !selectedTeamIdForMontaz || !newEventStartDate) : (!newEventTitle.trim() || !effectiveEventTypeId)}
                className="btn primary btn-xs"
                style={{
                  fontSize: 13,
                  padding: "7px 16px",
                  opacity: (newEventMode === "montaz" ? (selectedOrderIdForMontaz && selectedTeamIdForMontaz && newEventStartDate) : (newEventTitle.trim() && effectiveEventTypeId)) ? 1 : 0.45,
                }}
              >
                {newEventMode === "montaz" ? "Zapisz termin montażu" : "Zapisz zdarzenie"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Event detail modal */}
      {detailEvent && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setDetailEvent(null)} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 420,
            background: "var(--panel)", borderRadius: 12, border: "1px solid var(--line)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: "100%", height: 6, background: detailEvent.color }} />
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: detailEvent.color, background: `${detailEvent.color}22`, border: `1px solid ${detailEvent.color}44`, borderRadius: 4, padding: "2px 8px" }}>
                    {detailEvent.eventTypeName}
                    {detailEvent.isPrivate && " 🔒"}
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-strong)", margin: "10px 0 4px" }}>{detailEvent.title}</h3>
                  {detailEvent.start && (
                    <p style={{ fontSize: 12, color: "var(--text-mute)" }}>
                      {fmtDateTime(detailEvent.start)}{detailEvent.end ? ` – ${fmtDateTime(detailEvent.end)}` : ""}
                    </p>
                  )}
                  {detailEvent.description && (
                    <p style={{ fontSize: 13, color: "var(--text)", marginTop: 10, lineHeight: 1.5 }}>{detailEvent.description}</p>
                  )}
                  {detailEvent.assignedUserNames && detailEvent.assignedUserNames.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                        Przypisane osoby ({detailEvent.assignedUserNames.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {detailEvent.assignedUserNames.map((name, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              color: detailEvent.color,
                              background: `${detailEvent.color}18`,
                              border: `1px solid ${detailEvent.color}33`,
                              borderRadius: 20,
                              padding: "3px 10px",
                            }}
                          >
                            👤 {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setDetailEvent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: 6, flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="btn btn-xs"
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    color: "#ef4444",
                    background: "#ef444415",
                    border: "1px solid #ef444433",
                    fontWeight: 600,
                  }}
                >
                  🗑️ Usuń zdarzenie
                </button>
                <button onClick={() => setDetailEvent(null)} className="btn btn-xs" style={{ fontSize: 12, padding: "6px 14px" }}>Zamknij</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirm Delete Modal */}
      {confirmDeleteOpen && detailEvent && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }} onClick={() => !isDeleting && setConfirmDeleteOpen(false)} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 380,
            background: "var(--panel)", borderRadius: 14, border: "1px solid var(--line)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)", padding: "24px",
            display: "flex", flexDirection: "column", gap: 16,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: "#ef444415",
                border: "1px solid #ef444433", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0, color: "#ef4444",
              }}>
                🗑️
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                  Usunąć zdarzenie?
                </h4>
                <p style={{ fontSize: 12.5, color: "var(--text-mute)", margin: "4px 0 0", lineHeight: 1.4 }}>
                  Czy na pewno chcesz usunąć <strong style={{ color: "var(--text-strong)" }}>„{detailEvent.title}”</strong>? Całkowite usunięcie tego wydarzenia jest nieodwracalne.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                disabled={isDeleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="btn btn-xs"
                style={{ fontSize: 13, padding: "8px 16px", fontWeight: 500 }}
              >
                Anuluj
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteCalendarEvent({ id: detailEvent.id as Id<"calendarEvents"> });
                    setConfirmDeleteOpen(false);
                    setDetailEvent(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="btn primary btn-xs"
                style={{
                  fontSize: 13,
                  padding: "8px 18px",
                  background: "#ef4444",
                  borderColor: "#dc2626",
                  color: "#ffffff",
                  fontWeight: 600,
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? "Usuwanie..." : "Tak, usuń"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
