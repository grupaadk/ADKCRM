import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const websiteWebhook = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    street,
    buildingNumber,
    postalCode,
    city,
    stateRegion,
    services,
    comment,
    projectFiles,
    leadSource,
  } = payload as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    street?: string;
    buildingNumber?: string;
    postalCode?: string;
    city?: string;
    stateRegion?: string;
    services?: string[];
    comment?: string;
    projectFiles?: string;
    leadSource?: string;
  };

  if (!firstName && !lastName) {
    return new Response(
      JSON.stringify({ error: "Brak danych: imię i nazwisko wymagane" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const submissionId = "www-" + Date.now().toString();

  const clientId = await ctx.runMutation(api.jotformInternal.createOrFindClient, {
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    email: email ?? undefined,
    phone: phone ?? undefined,
    street: street ?? undefined,
    buildingNumber: buildingNumber ?? undefined,
    postalCode: postalCode ?? undefined,
    city: city ?? undefined,
    submissionId,
  });

  const pendingId = await ctx.runMutation(api.jotformInternal.savePendingSubmission, {
    clientId,
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    email: email ?? undefined,
    phone: phone ?? undefined,
    street: street ?? undefined,
    buildingNumber: buildingNumber ?? undefined,
    postalCode: postalCode ?? undefined,
    city: city ?? undefined,
    services: Array.isArray(services) ? services : [],
    comment: comment ?? undefined,
    projectFiles: projectFiles ?? undefined,
    leadSource: leadSource ?? undefined,
    submissionId,
  });

  return new Response(
    JSON.stringify({ status: "success", pendingId }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});

export const websiteWebhookOptions = httpAction(async () => {
  return new Response(null, { status: 200, headers: corsHeaders });
});
