import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMapInspector } from "../../context/mapInspectorState";

export default function MapFeatureDetails({ featureId, children }: { featureId: string; children: ReactNode }) {
  const { selection, host, dismiss } = useMapInspector();
  const selected = selection?.id === featureId;

  useEffect(() => () => dismiss(featureId), [featureId, dismiss]);

  return selected && host ? createPortal(children, host, featureId) : null;
}
