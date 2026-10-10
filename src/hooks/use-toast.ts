import { toast as sonnerToast } from "sonner";

export function useToast() {
  const toast = ({
    title,
    description,
    variant,
  }: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => {
    sonnerToast(title || "", {
      description,
      style: variant === "destructive" ? { background: "#ef4444", color: "#ffffff" } : undefined,
    });
  };

  return { toast };
}
