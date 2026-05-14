"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

/**
 * Inner component that watches for session invalidation
 * (e.g. password changed) and forces re-authentication.
 */
function SessionWatcher({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (
      session &&
      session.error === "PasswordChanged"
    ) {
      signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  return <>{children}</>;
}

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SessionWatcher>{children}</SessionWatcher>
    </SessionProvider>
  );
}
