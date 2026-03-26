import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    currency?: string;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      currency?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    currency?: string;
  }
}
