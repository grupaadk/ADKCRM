import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const websiteWebhook = httpAction(async (ctx, request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const { firstName, lastName, email, phone, city, comment } = payload;

  if (!firstName && !lastName) {
    return new Response(
      JSON.stringify({ error: "Brak danych: imię i nazwisko wymagane" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const submissionId = "www-" + Date.now().toString();

  // Utwórz klienta od razu przy zgłoszeniu (lub znajdź istniejącego)
  const clientId = await ctx.runMutation(
    api.jotformInternal.createOrFindClient,
    {
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      email: email ?? undefined,
      phone: phone ?? undefined,
      city: city ?? undefined,
      submissionId,
    },
  );

  // Zapisz zgłoszenie jako oczekujące
  const pendingId = await ctx.runMutation(
    api.jotformInternal.savePendingSubmission,
    { 
      clientId,
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      email: email ?? undefined,
      phone: phone ?? undefined,
      city: city ?? undefined,
      comment: comment ?? undefined,
      submissionId,
      services: [], // opcjonalnie z formularza
    },
  );

  return new Response(
    JSON.stringify({ status: "success", pendingId }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});

export const websiteWebhookOptions = httpAction(async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});
