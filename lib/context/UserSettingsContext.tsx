"use client";

import { createContext, useContext, useEffect, useState } from "react";

type UserSettings = {
  currency: string;
  locale: string;
};

const UserSettingsContext = createContext<UserSettings>({
  currency: "USD",
  locale: "en-US",
});

export function UserSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<UserSettings>({
    currency: "USD",
    locale: "en-US",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          currency: data.currency ?? "USD",
          locale: data.locale ?? "en-US",
        });
      })
      .catch(() => {
        // keep defaults on error
      });
  }, []);

  return (
    <UserSettingsContext.Provider value={settings}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettings {
  return useContext(UserSettingsContext);
}
