const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  processing: "bg-blue-100 text-blue-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
  disabled: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  active: "可用",
  processing: "处理中",
  pending_review: "待审核",
  rejected: "已拒绝",
  disabled: "已禁用",
};

export function VoiceStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
