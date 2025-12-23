// src/client/components/browserpage/SelectionBox.tsx
interface SelectionBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SelectionBox({ x, y, width, height }: SelectionBoxProps) {
  return (
    <div
      className="fixed z-50 bg-accent/20 border border-accent rounded pointer-events-none"
      style={{
        left: x,
        top: y,
        width,
        height
      }}
    />
  );
}
