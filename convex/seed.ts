import { mutation } from "./_generated/server";

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("clients").first();
    if (existing) return "Already seeded";

    const disabledDoc = { enabled: false as boolean };
    const enabledDoc = { enabled: true as boolean, url: "" };

    const allDisabled = {
      pomiar: disabledDoc,
      umowa: disabledDoc,
      gwarancja_alco: disabledDoc,
      rekojmia_adk: disabledDoc,
      odbior_inwestor: disabledDoc,
      protokol_montaz: disabledDoc,
      faktura: disabledDoc,
      reklamacja: disabledDoc,
    };

    const allEnabled = {
      pomiar: enabledDoc,
      umowa: enabledDoc,
      gwarancja_alco: enabledDoc,
      rekojmia_adk: enabledDoc,
      odbior_inwestor: enabledDoc,
      protokol_montaz: enabledDoc,
      faktura: enabledDoc,
      reklamacja: disabledDoc,
    };

    const clients = [
      {
        firstName: "Jan",
        lastName: "Kowalski",
        email: "jan.kowalski@gmail.com",
        phone: "+48 501 234 567",
        city: "Warszawa",
        address: "ul. Marszalkowska 10/5",
        status: "contract" as const,
        services: ["Okna", "Drzwi"],
        comment: "Klient preferuje kontakt telefoniczny po 16:00",
        source: "jotform" as const,
        documents: {
          ...allDisabled,
          pomiar: enabledDoc,
          umowa: enabledDoc,
        },
        warrantyCards: [],
        createdBy: "system",
      },
      {
        firstName: "Anna",
        lastName: "Nowak",
        email: "anna.nowak@wp.pl",
        phone: "+48 602 345 678",
        city: "Krakow",
        address: "os. Zielone 15/3",
        status: "measurement" as const,
        services: ["Okna", "System przeciwsloneczny"],
        comment: "Wymiana okien w calym mieszkaniu, 6 sztuk",
        source: "jotform" as const,
        documents: {
          ...allDisabled,
          pomiar: enabledDoc,
        },
        warrantyCards: [],
        createdBy: "system",
      },
      {
        firstName: "Piotr",
        lastName: "Wisniewski",
        email: "p.wisniewski@onet.pl",
        phone: "+48 503 456 789",
        city: "Wroclaw",
        address: "ul. Pilsudskiego 22",
        status: "lead" as const,
        services: ["Brama"],
        comment: "Zainteresowany brama segmentowa Wisniowski",
        source: "manual" as const,
        documents: allDisabled,
        warrantyCards: [],
        createdBy: "system",
      },
      {
        firstName: "Maria",
        lastName: "Zielinska",
        email: "maria.z@gmail.com",
        phone: "+48 604 567 890",
        city: "Poznan",
        address: "ul. Dabrowskiego 5/10",
        status: "offer" as const,
        services: ["Okna", "Drzwi"],
        comment: "Nowy dom, komplet stolarki",
        source: "jotform" as const,
        documents: {
          ...allDisabled,
          pomiar: enabledDoc,
        },
        warrantyCards: [],
        createdBy: "system",
      },
      {
        firstName: "Tomasz",
        lastName: "Lewandowski",
        email: "t.lewandowski@firma.pl",
        phone: "+48 505 678 901",
        city: "Gdansk",
        address: "ul. Dluga 45",
        status: "installation" as const,
        services: ["Okna", "Brama", "Drzwi"],
        comment: "Montaz zaplanowany na przyszly tydzien",
        source: "jotform" as const,
        documents: {
          ...allDisabled,
          pomiar: enabledDoc,
          umowa: enabledDoc,
          faktura: enabledDoc,
          protokol_montaz: disabledDoc,
        },
        warrantyCards: [],
        createdBy: "system",
      },
      {
        firstName: "Katarzyna",
        lastName: "Wojciechowska",
        email: "k.wojciechowska@yahoo.com",
        phone: "+48 606 789 012",
        city: "Lodz",
        address: "ul. Piotrkowska 120/8",
        status: "completed" as const,
        services: ["Okna"],
        comment: "Wszystko zamontowane, klient bardzo zadowolony",
        source: "manual" as const,
        documents: allEnabled,
        warrantyCards: [
          {
            manufacturer: "ABAKUS / Salamander",
            type: "Okna",
            fileUrl: "",
            uploadedAt: Date.now(),
          },
        ],
        createdBy: "system",
      },
      {
        firstName: "Marek",
        lastName: "Kaminski",
        email: "marek.k@interia.pl",
        phone: "+48 507 890 123",
        city: "Szczecin",
        address: "ul. Niepodleglosci 8",
        status: "inquiry" as const,
        services: ["Drzwi", "System przeciwsloneczny"],
        source: "jotform" as const,
        documents: allDisabled,
        warrantyCards: [],
        createdBy: "system",
      },
      {
        firstName: "Agnieszka",
        lastName: "Dabrowska",
        email: "agnieszka.d@gmail.com",
        phone: "+48 608 901 234",
        city: "Lublin",
        address: "ul. Krakowskie Przedmiescie 30",
        status: "complaint" as const,
        services: ["Okna", "Drzwi"],
        comment: "Reklamacja uszczelki w jednym oknie",
        source: "jotform" as const,
        documents: {
          ...allEnabled,
          reklamacja: enabledDoc,
        },
        warrantyCards: [
          {
            manufacturer: "ABM Jedraszek / VEKA",
            type: "Okna",
            fileUrl: "",
            uploadedAt: Date.now(),
          },
          {
            manufacturer: "WIKED",
            type: "Drzwi",
            fileUrl: "",
            uploadedAt: Date.now(),
          },
        ],
        createdBy: "system",
      },
    ];

    for (const clientData of clients) {
      const clientId = await ctx.db.insert("clients", clientData);

      // Add creation event
      await ctx.db.insert("clientEvents", {
        clientId,
        type: "created",
        performedBy: "system",
        details: { source: clientData.source },
      });

      // Add status change event for non-lead clients
      if (clientData.status !== "lead") {
        await ctx.db.insert("clientEvents", {
          clientId,
          type: "status_changed",
          performedBy: "admin",
          details: { from: "lead", to: clientData.status },
        });
      }
    }

    // Document templates
    const templates = [
      {
        key: "pomiar",
        name: "Protokol pomiaru",
        fileNamePattern: "Pomiar_{{firstName}}_{{lastName}}_{{city}}",
        fieldMappings: [
          { placeholder: "{{imie}}", field: "firstName" },
          { placeholder: "{{nazwisko}}", field: "lastName" },
          { placeholder: "{{miasto}}", field: "city" },
          { placeholder: "{{adres}}", field: "address" },
          { placeholder: "{{telefon}}", field: "phone" },
          { placeholder: "{{data}}", field: "__today" },
        ],
        version: 1,
        isActive: true,
      },
      {
        key: "umowa",
        name: "Umowa",
        fileNamePattern: "Umowa_{{firstName}}_{{lastName}}_{{city}}",
        fieldMappings: [
          { placeholder: "{{imie}}", field: "firstName" },
          { placeholder: "{{nazwisko}}", field: "lastName" },
          { placeholder: "{{miasto}}", field: "city" },
          { placeholder: "{{adres}}", field: "address" },
          { placeholder: "{{email}}", field: "email" },
          { placeholder: "{{telefon}}", field: "phone" },
          { placeholder: "{{uslugi}}", field: "services" },
          { placeholder: "{{data}}", field: "__today" },
          { placeholder: "{{rok}}", field: "__year" },
        ],
        version: 1,
        isActive: true,
      },
      {
        key: "faktura",
        name: "Faktura",
        fileNamePattern: "Faktura_{{firstName}}_{{lastName}}",
        fieldMappings: [
          { placeholder: "{{imie}}", field: "firstName" },
          { placeholder: "{{nazwisko}}", field: "lastName" },
          { placeholder: "{{data}}", field: "__today" },
        ],
        version: 1,
        isActive: true,
      },
    ];

    for (const template of templates) {
      await ctx.db.insert("documentTemplates", template);
    }

    return "Seeded 8 clients + 3 templates";
  },
});
