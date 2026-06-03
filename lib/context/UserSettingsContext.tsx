"use client";

import { createContext, useContext, useEffect, useState } from "react";

type UserSettings = {
  currency: string;
  locale: string;
};

type UserSettingsContextValue = {
  settings: UserSettings;
  rates: Record<string, number>;
};

const UserSettingsContext = createContext<UserSettingsContextValue>({
  settings: { currency: "USD", locale: "en-US" },
  rates: {},
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
  const [rates, setRates] = useState<Record<string, number>>({});

  // Load user preferences from the API on mount
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

  // Refresh exchange rates whenever the user's base currency changes
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/rates?base=${settings.currency}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.rates) {
          setRates(data.rates as Record<string, number>);
        }
      })
      .catch(() => {
        // rates remain as-is; all amounts fall back to no-op conversion
      });

    return () => {
      cancelled = true;
    };
  }, [settings.currency]);

  return (
    <UserSettingsContext.Provider value={{ settings, rates }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  return useContext(UserSettingsContext);
}
