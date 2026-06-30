import { createFileRoute } from "@tanstack/react-router";
import { EstatisticasPage } from "@/components/EstatisticasPage";

export const Route = createFileRoute("/estatisticas")({
  component: EstatisticasPage,
});