import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)"]);
const isLoginRoute = createRouteMatcher(["/login"]);
const isRootRoute = createRouteMatcher(["/"]);
const isEkipaRoute = createRouteMatcher(["/ekipa(.*)"]);

const isAdminRootRoute = createRouteMatcher(["/admin"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Crew PWA uses PIN-based auth — no Convex Auth check needed
  if (isEkipaRoute(request)) {
    return;
  }

  const isAuthed = await convexAuth.isAuthenticated();

  if (isProtectedRoute(request) && !isAuthed) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isLoginRoute(request) && isAuthed) {
    return nextjsMiddlewareRedirect(request, "/admin/dashboard");
  }
  if (isAdminRootRoute(request) && isAuthed) {
    return nextjsMiddlewareRedirect(request, "/admin/dashboard");
  }
  if (isRootRoute(request)) {
    if (!isAuthed) {
      return nextjsMiddlewareRedirect(request, "/login");
    } else {
      return nextjsMiddlewareRedirect(request, "/admin/dashboard");
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
