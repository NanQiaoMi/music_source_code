import type { ParameterMode } from "./types";

const PARAMETER_MODE_ORDER: ParameterMode[] = ["basic", "professional", "expert"];

export function shouldShowParameterMode(
  parameterMode: ParameterMode,
  currentMode: ParameterMode
): boolean {
  const parameterIndex = PARAMETER_MODE_ORDER.indexOf(parameterMode);
  const currentIndex = PARAMETER_MODE_ORDER.indexOf(currentMode);

  if (parameterIndex === -1 || currentIndex === -1) {
    return false;
  }

  return parameterIndex <= currentIndex;
}
