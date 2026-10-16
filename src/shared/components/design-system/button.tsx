import { Button as UiButton } from "@/components/ui/button";

type UiButtonProps = React.ComponentProps<typeof UiButton>;

interface ButtonProps extends Omit<UiButtonProps, "variant"> {
  variant?: UiButtonProps["variant"] | "primary";
}

export function Button({ variant, ...props }: ButtonProps) {
  return <UiButton {...props} variant={variant === "primary" ? "default" : variant} />;
}