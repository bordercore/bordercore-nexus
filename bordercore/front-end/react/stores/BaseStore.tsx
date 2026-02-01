import React, { createContext, useContext, useState, ReactNode } from "react";

interface BaseStoreContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

const BaseStoreContext = createContext<BaseStoreContextType | undefined>(undefined);

export function BaseStoreProvider({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <BaseStoreContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
      }}
    >
      {children}
    </BaseStoreContext.Provider>
  );
}

export function useBaseStore() {
  const context = useContext(BaseStoreContext);
  if (context === undefined) {
    throw new Error("useBaseStore must be used within a BaseStoreProvider");
  }
  return context;
}
