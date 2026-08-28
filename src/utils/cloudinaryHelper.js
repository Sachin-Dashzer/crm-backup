
export const getViewableUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return url;

  return url;
};

export const openFileInNewTab = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const downloadFile = (url, filename) => {
  if (!url) return;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const isPdfUrl = (url) => {
  if (!url) return false;
  return url.toLowerCase().endsWith('.pdf');
};

export const getFileName = (url) => {
  if (!url) return '';
  try {
    const parts = url.split('/');
    const fileNameWithParams = parts[parts.length - 1];
    const fileName = fileNameWithParams.split('?')[0];
    return decodeURIComponent(fileName);
  } catch (error) {
    return url;
  }
};

export const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return '';

  const parts = url.split('/upload/');
  if (parts.length !== 2) return '';

  const pathPart = parts[1];
  const segments = pathPart.split('/');

  let publicIdParts = [];
  let foundPath = false;

  for (const segment of segments) {
    if (!foundPath && /^[a-z]+_/.test(segment)) {
      continue;
    }
    foundPath = true;
    publicIdParts.push(segment);
  }

  const publicId = publicIdParts.join('/');
  return publicId.replace(/\.[^/.]+$/, '');
};

export const getResourceType = (url) => {
  if (!url) return 'raw';

  if (url.toLowerCase().endsWith('.pdf')) return 'raw';
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)) return 'image';

  return 'raw';
};