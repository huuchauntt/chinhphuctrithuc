import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDirectMediaUrl(url: string | undefined, type: 'image' | 'audio' | 'video' | 'unknown' = 'unknown'): string {
  if (!url) return '';
  
  let fileId = '';
  
  // Handle drive.google.com/file/d/ID/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    fileId = fileMatch[1];
  } else {
    // Handle drive.google.com/open?id=ID or drive.google.com/uc?id=ID
    const openMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (url.includes('drive.google.com') && openMatch && openMatch[1]) {
      fileId = openMatch[1];
    }
  }

  if (fileId) {
    if (type === 'image') {
      // Use thumbnail endpoint for images as it's more reliable for embedding and bypasses virus scan warnings
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    // For audio/video, export=download is required to get the raw stream
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  
  return url;
}
