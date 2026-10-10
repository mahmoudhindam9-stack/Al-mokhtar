import { createFileRoute } from "@tanstack/react-router";
import { Route as LoginRoute } from "./login";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "المختار لإدارة المشروعات — لوحة التحكم الرئيسية" },
      {
        name: "description",
        content: "المختار لإدارة المشروعات — نظام متكامل لإدارة المشروعات والمحاسبة ERP والخزائن.",
      },
    ],
  }),
  component: HomeLogin,
});

function HomeLogin() {
  const Login = LoginRoute.options.component as React.ElementType;
  return <Login />;
}
