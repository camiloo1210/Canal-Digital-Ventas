export interface FileUploadResult {
  path: string;
  url: string;
}

export interface FileStoragePort {
  upload(file: unknown, destinationPath: string): Promise<FileUploadResult>;
  delete(path: string): Promise<void>;
}
