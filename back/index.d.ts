declare namespace Express {
  interface Request {
    platform: 'desktop' | 'mobile';
    authorization?: any;
  }
}

declare module 'pstree.remy';
