
export function isPdfDocument(doc) {
  if (!doc) return false;
  if (typeof doc.format === 'string' && doc.format.toLowerCase() === 'pdf') return true;
  if (typeof doc.name === 'string' && /\.pdf$/i.test(doc.name)) return true;
  if (typeof doc.publicId === 'string' && /\.pdf$/i.test(doc.publicId)) return true;
  return false;
}

export function documentViewUrl(doc) {
  if (!doc) return '';
  if (!isPdfDocument(doc)) return doc.url || '';

  const params = new URLSearchParams({ publicId: doc.publicId });
  if (doc.resourceType) params.set('resourceType', doc.resourceType);
  if (doc.format) params.set('format', doc.format);

  return `/api/documents?${params.toString()}`;
}
export function documentPreviewUrl(doc) {
  if (!doc) return '';
  if (!isPdfDocument(doc)) return doc.url || '';

  const params = new URLSearchParams({ publicId: doc.publicId, preview: '1' });
  if (doc.resourceType) params.set('resourceType', doc.resourceType);

  return `/api/documents?${params.toString()}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
