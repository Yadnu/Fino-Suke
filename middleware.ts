export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/expenses/:path*",
    "/budget/:path*",
    "/income/:path*",
    "/savings/:path*",
    "/bills/:path*",
    "/analytics/:path*",
    "/networth/:path*",
    "/ai-assistant/:path*",
    "/settings/:path*",
  ],
};
