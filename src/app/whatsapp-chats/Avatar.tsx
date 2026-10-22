const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
];

// Cor deterministica a partir do nome - o mesmo lead sempre cai na mesma
// cor, igual WhatsApp/Slack fazem com iniciais.
function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initialsForName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass} ${colorForName(name)}`}
    >
      {initialsForName(name)}
    </div>
  );
}
