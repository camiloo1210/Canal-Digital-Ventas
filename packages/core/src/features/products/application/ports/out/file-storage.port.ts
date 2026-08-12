export interface FileUploadResult {
  path: string;
  url: string;
}

export interface FileStoragePort {
  upload(file: any, destinationPath: string): Promise<FileUploadResult>;
  delete(path: string): Promise<void>;
}
