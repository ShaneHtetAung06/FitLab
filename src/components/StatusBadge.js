const STATUS_STYLES = {
  pending: {
    label: 'Pending review',
    className: 'bg-amber-100 text-amber-800',
    icon: '⏳',
  },
  approved: {
    label: 'Approved',
    className: 'bg-accent-100 text-accent-700',
    icon: '✅',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-700',
    icon: '❌',
  },
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-700',
    icon: '•',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-sm font-medium rounded-full ${style.className}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}
