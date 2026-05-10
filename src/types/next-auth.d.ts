import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    ptaCode?: string | null;
    position?: string | null;
    department?: string | null;
    roles: Array<{
      id: string;
      code: string;
      name: string;
      permissions: string[];
    }>;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      ptaCode?: string | null;
      position?: string | null;
      department?: string | null;
      avatar?: string | null;
      roles: Array<{
        id: string;
        code: string;
        name: string;
        permissions: string[];
      }>;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    ptaCode?: string | null;
    position?: string | null;
    department?: string | null;
    roles: Array<{
      id: string;
      code: string;
      name: string;
      permissions: string[];
    }>;
  }
}
