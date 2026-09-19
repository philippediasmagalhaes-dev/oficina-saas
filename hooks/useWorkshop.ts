"use client";

import { useEffect, useState } from "react";
import {
  addAppointment,
  addClient,
  addOrder,
  advanceOrderStatus,
  cloneWorkshopState,
  type NewAppointment,
  type NewClient,
  type NewOrder,
  type WorkshopState,
} from "../lib/workshop";
import { loadWorkshop, saveWorkshop } from "./workshop-storage";

export function useWorkshop() {
  const [state, setState] = useState<WorkshopState>(() => cloneWorkshopState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadWorkshop(window.localStorage));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveWorkshop(window.localStorage, state);
  }, [hydrated, state]);

  return {
    ...state,
    hydrated,
    createOrder: (input: NewOrder) =>
      setState((current) => addOrder(current, input)),
    createClient: (input: NewClient) =>
      setState((current) => addClient(current, input)),
    createAppointment: (input: NewAppointment) =>
      setState((current) => addAppointment(current, input)),
    advanceOrder: (id: string) =>
      setState((current) => advanceOrderStatus(current, id)),
  };
}
