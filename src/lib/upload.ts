export interface UploadProgressInfo {
  loaded: number;
  total: number;
  speed: number;
}

export interface UploadHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export function uploadToUrl(url: string, file: File, onProgress: (info: UploadProgressInfo) => void): UploadHandle {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<void>((resolve, reject) => {
    const start = performance.now();

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = (performance.now() - start) / 1000;
      onProgress({ loaded: e.loaded, total: e.total, speed: elapsed > 0 ? e.loaded / elapsed : 0 });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error('This file is too large to upload.'));
      else reject(new Error('Upload failed. Please try again.'));
    };
    xhr.onerror = () => reject(new Error('Upload was blocked. The storage may not be set up to accept uploads from this site yet.'));
    xhr.onabort = () => reject(new Error('cancelled'));

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });

  return { promise, cancel: () => xhr.abort() };
}
