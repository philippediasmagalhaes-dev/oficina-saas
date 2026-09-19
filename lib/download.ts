export type DownloadLink = {
  download: string;
  href: string;
  click(): void;
};

export type DownloadEnvironment = {
  createLink(): DownloadLink;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

function browserEnvironment(): DownloadEnvironment {
  return {
    createLink: () => document.createElement("a"),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
  environment: DownloadEnvironment = browserEnvironment(),
): void {
  const link = environment.createLink();
  const objectUrl = environment.createObjectURL(
    new Blob([content], { type: mimeType }),
  );
  link.download = filename;
  link.href = objectUrl;
  try {
    link.click();
  } finally {
    environment.revokeObjectURL(objectUrl);
  }
}
