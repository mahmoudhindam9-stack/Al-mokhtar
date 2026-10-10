import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/components")({
  head: () => ({ meta: [{ title: "المكونات — المختار" }] }),
  component: ComponentsRoute,
});

function ComponentsRoute() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/login", replace: true });
  }, [navigate]);
  return null;
}
