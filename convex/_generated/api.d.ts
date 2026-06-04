/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as clients from "../clients.js";
import type * as complaints from "../complaints.js";
import type * as crmConfig from "../crmConfig.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as documentTemplates from "../documentTemplates.js";
import type * as emailClassification from "../emailClassification.js";
import type * as events from "../events.js";
import type * as fakturownia from "../fakturownia.js";
import type * as gmail from "../gmail.js";
import type * as gmailAuth from "../gmailAuth.js";
import type * as googleDrive from "../googleDrive.js";
import type * as googleDriveAuth from "../googleDriveAuth.js";
import type * as http from "../http.js";
import type * as jotform from "../jotform.js";
import type * as jotformAdmin from "../jotformAdmin.js";
import type * as jotformInternal from "../jotformInternal.js";
import type * as kanban from "../kanban.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_sentry from "../lib/sentry.js";
import type * as migrations from "../migrations.js";
import type * as notes from "../notes.js";
import type * as orderLineItems from "../orderLineItems.js";
import type * as orderTasks from "../orderTasks.js";
import type * as orders from "../orders.js";
import type * as paymentReminders from "../paymentReminders.js";
import type * as places from "../places.js";
import type * as salesOpportunities from "../salesOpportunities.js";
import type * as seed from "../seed.js";
import type * as servicePricing from "../servicePricing.js";
import type * as sms from "../sms.js";
import type * as storage from "../storage.js";
import type * as systemLogs from "../systemLogs.js";
import type * as users from "../users.js";
import type * as viewConfig from "../viewConfig.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attachments: typeof attachments;
  auth: typeof auth;
  clients: typeof clients;
  complaints: typeof complaints;
  crmConfig: typeof crmConfig;
  crons: typeof crons;
  dashboard: typeof dashboard;
  documentTemplates: typeof documentTemplates;
  emailClassification: typeof emailClassification;
  events: typeof events;
  fakturownia: typeof fakturownia;
  gmail: typeof gmail;
  gmailAuth: typeof gmailAuth;
  googleDrive: typeof googleDrive;
  googleDriveAuth: typeof googleDriveAuth;
  http: typeof http;
  jotform: typeof jotform;
  jotformAdmin: typeof jotformAdmin;
  jotformInternal: typeof jotformInternal;
  kanban: typeof kanban;
  "lib/auth": typeof lib_auth;
  "lib/crypto": typeof lib_crypto;
  "lib/sentry": typeof lib_sentry;
  migrations: typeof migrations;
  notes: typeof notes;
  orderLineItems: typeof orderLineItems;
  orderTasks: typeof orderTasks;
  orders: typeof orders;
  paymentReminders: typeof paymentReminders;
  places: typeof places;
  salesOpportunities: typeof salesOpportunities;
  seed: typeof seed;
  servicePricing: typeof servicePricing;
  sms: typeof sms;
  storage: typeof storage;
  systemLogs: typeof systemLogs;
  users: typeof users;
  viewConfig: typeof viewConfig;
  whitelist: typeof whitelist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
